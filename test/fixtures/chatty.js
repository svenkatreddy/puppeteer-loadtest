// Prints ~2MB to stdout: with the old exec buffer this failed with
// "maxBuffer length exceeded"; with streaming it must pass.
const chunk = 'x'.repeat(1024);
for (let i = 0; i < 2048; i += 1) {
  console.log(chunk);
}
