// Test script to verify fluent-ffmpeg works correctly
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

console.log('========== Testing fluent-ffmpeg ==========');
console.log('1. ffmpeg type:', typeof ffmpeg);
console.log('2. ffmpeg name:', ffmpeg.name);

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log('3. FFmpeg path set to:', ffmpegInstaller.path);

// Create a command
console.log('\n========== Creating command ==========');
let command = ffmpeg();
console.log('4. command type:', typeof command);
console.log('5. command.input type:', typeof command.input);
console.log('6. command constructor:', command.constructor.name);

// Try adding an input
console.log('\n========== Testing input() method ==========');
try {
  command.input('/test/video.mp4');
  console.log('7. ✓ command.input() succeeded!');
  console.log('8. Inputs count:', command._inputs.length);
} catch (error) {
  console.log('7. ✗ command.input() failed:', error.message);
}

// Test chaining
console.log('\n========== Testing chaining ==========');
try {
  const command2 = ffmpeg();
  command2.input('/test/video1.mp4').input('/test/video2.mp4');
  console.log('9. ✓ Chaining succeeded!');
  console.log('10. Inputs count:', command2._inputs.length);
} catch (error) {
  console.log('9. ✗ Chaining failed:', error.message);
}

console.log('\n========== All tests passed! ==========');

