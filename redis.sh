#!/bin/bash

CMD=""
SYSTEM=""
CLUSTER_COUNT=30
REPLICAS=1

while [ $# -gt 0 ]; do
  case "$1" in
    -setup|-stop|-resume|-clean)
      CMD="$1"
      ;;
    -prod)
      SYSTEM="-prod"
      ;;
    -n|--nodes)
      CLUSTER_COUNT="$2"
      shift
      ;;
    -r|--replicas)
      REPLICAS="$2"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./redis.sh -setup|-stop|-resume|-clean [-prod] [-n NODES] [-r REPLICAS]"
      exit 1
      ;;
  esac
  shift
done

if [ -z "$CMD" ]; then
  echo "Usage: ./redis.sh -setup|-stop|-resume|-clean [-prod] [-n NODES] [-r REPLICAS]"
  exit 1
fi

if ! [[ "$CLUSTER_COUNT" =~ ^[0-9]+$ ]] || [ "$CLUSTER_COUNT" -lt 3 ]; then
  echo "Invalid node count: $CLUSTER_COUNT"
  exit 1
fi

if ! [[ "$REPLICAS" =~ ^[0-9]+$ ]]; then
  echo "Invalid replicas count: $REPLICAS"
  exit 1
fi

MASTERS=$((CLUSTER_COUNT / (REPLICAS + 1)))
if [ $((MASTERS * (REPLICAS + 1))) -ne "$CLUSTER_COUNT" ] || [ "$MASTERS" -lt 3 ]; then
  echo "Invalid topology: nodes must be divisible by (replicas + 1) and have at least 3 masters"
  exit 1
fi

END_PORT=$((7000 + CLUSTER_COUNT - 1))

if [ "$SYSTEM" == "-prod" ]; then
  REDIS_SVR="redis6-server"
  REDIS_CLI="redis6-cli"
else
  REDIS_SVR="redis-server"
  REDIS_CLI="redis-cli"
fi

if [ "$CMD" == "-setup" ]; then
  mkdir -p ../redis-cluster
  cd ../redis-cluster || exit 1

  for port in $(seq 7000 $END_PORT); do
    mkdir -p "$port"
    cat <<EOF > "$port/redis.conf"
port $port
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
save ""
appendonly no
protected-mode no
bind 127.0.0.1
maxclients 100000
EOF
    $REDIS_SVR "./$port/redis.conf" --daemonize yes --dir "./$port"
  done

  sleep 5

  $REDIS_CLI --cluster create \
  $(for port in $(seq 7000 $END_PORT); do echo -n "127.0.0.1:$port "; done) \
  --cluster-replicas "$REPLICAS" --cluster-yes

elif [ "$CMD" == "-stop" ]; then
  for port in $(seq 7000 $END_PORT); do
    $REDIS_CLI -p "$port" shutdown 2>/dev/null
  done
  pkill -f "$REDIS_SVR.*redis-cluster" 2>/dev/null

elif [ "$CMD" == "-resume" ]; then
  for port in $(seq 7000 $END_PORT); do
    $REDIS_SVR "../redis-cluster/$port/redis.conf" --daemonize yes --dir "../redis-cluster/$port"
  done

elif [ "$CMD" == "-clean" ]; then
  for port in $(seq 7000 $END_PORT); do
    $REDIS_CLI -p "$port" shutdown 2>/dev/null
  done
  pkill -f "$REDIS_SVR.*redis-cluster" 2>/dev/null

  for port in $(seq 7000 $END_PORT); do
    rm -rf "../redis-cluster/$port"
  done

  if [ -d "../redis-cluster" ] && [ -z "$(ls -A ../redis-cluster)" ]; then
    rmdir "../redis-cluster"
  fi
else
  echo "Usage: ./redis.sh -setup|-stop|-resume|-clean [-prod] [-n NODES] [-r REPLICAS]"
  exit 1
fi
