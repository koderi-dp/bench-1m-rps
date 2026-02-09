import { SPARKLINE_CHARS } from "../config/constants.js";

/**
 * Format a number with thousands separators
 * @param {number} num - The number to format
 * @returns {string} Formatted number (e.g., "1,000,000")
 */
export function formatNumber(num) {
  if (num == null || isNaN(num)) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size (e.g., "1.5 GB")
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * Format milliseconds to human-readable duration
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration (e.g., "1h 23m")
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Generate a sparkline from an array of values
 * @param {number[]} values - Array of numeric values
 * @param {number} width - Maximum width of sparkline
 * @returns {object} {text: string, color: string}
 */
export function generateSparkline(values, width = 12) {
  if (!values || values.length === 0) {
    return { text: "─".repeat(width), color: "gray" };
  }

  // Take last 'width' values
  const data = values.slice(-width);
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  // Map values to sparkline characters
  const sparkline = data.map(val => {
    const normalized = (val - min) / range;
    const index = Math.min(
      Math.floor(normalized * (SPARKLINE_CHARS.length - 1)),
      SPARKLINE_CHARS.length - 1
    );
    return SPARKLINE_CHARS[index];
  }).join('');

  // Determine trend color
  const first = data[0];
  const last = data[data.length - 1];
  const change = ((last - first) / first) * 100;
  
  let color = "cyan"; // neutral
  if (change > 5) color = "green";  // trending up
  if (change < -5) color = "red";   // trending down

  return { text: sparkline, color };
}

/**
 * Strip ANSI color codes from text
 * @param {string} text - Text with ANSI codes
 * @returns {string} Clean text
 */
export function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Truncate text to maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text with ellipsis if needed
 */
export function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Pad string to exact length
 * @param {string} text - Text to pad
 * @param {number} length - Target length
 * @param {string} char - Padding character
 * @param {string} align - 'left' or 'right'
 * @returns {string} Padded text
 */
export function pad(text, length, char = ' ', align = 'right') {
  const str = String(text);
  if (str.length >= length) return str;
  
  const padding = char.repeat(length - str.length);
  return align === 'left' ? str + padding : padding + str;
}

/**
 * Format timestamp to HH:MM:SS
 * @param {Date} date - Date object
 * @returns {string} Formatted time
 */
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Create a progress bar
 * @param {number} value - Current value
 * @param {number} max - Maximum value
 * @param {number} width - Bar width in characters
 * @returns {string} Progress bar string
 */
export function progressBar(value, max, width = 20) {
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  
  return '█'.repeat(filled) + '░'.repeat(empty);
}
