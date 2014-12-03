module.exports = {
  config: {
    port: 8888,
    verbose: true,
    glob: [
      '**/bundle.js'
    ]
  },
  ready: function ready() {
    console.log('I quess we are ready');
  },
  resolver: function resolver(filepath, callback) {
    console.log('Please resolve me:', filepath);
  }
};
