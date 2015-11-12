module.exports = function(config) {
  config.set({
    plugins: [
      require('../index.js')
    ],
    framework: ['jasmine'],
    singleRun: true,
    autoWatch: false,
    basePath: '',
    files: [
      'unlinted.js'
    ],
    preprocessors: {
      '*.js': ['jshint']
    },
    jshintPreprocessor: {
      jshintrc: './.jshintrc',
      stopOnError: true
    }
  });
};
