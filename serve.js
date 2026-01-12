const { exec } = require("child_process");

exec("serve out -l 3000", (err, stdout, stderr) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(stdout);
});
