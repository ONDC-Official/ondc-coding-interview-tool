// pm2 process definition for the ONDC Coding Interview server on the EC2.
// Deployed to /home/ubuntu/ondc-coding-interview-tool/ by the GitHub Actions
// workflow (.github/workflows/deploy.yml). The server serves the built client
// (../client/dist) and the WebSocket sync endpoint on PORT.
module.exports = {
  apps: [
    {
      name: 'ondc-coding-interview',
      cwd: '/home/ubuntu/ondc-coding-interview-tool/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '1234',
        MAX_USERS_PER_ROOM: '2',
        CLIENT_DIST: '/home/ubuntu/ondc-coding-interview-tool/client/dist',
      },
    },
  ],
};
