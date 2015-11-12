# karma-jshint-preprocessor
[![Code Climate](https://codeclimate.com/github/kylewelsby/karma-jshint-preprocessor.png)](https://codeclimate.com/github/kylewelsby/karma-jshint-preprocessor)
[![Dependency Status](https://david-dm.org/kylewelsby/karma-jshint-preprocessor.png)](https://david-dm.org/kylewelsby/karma-jshint-preprocessor)
[![Build Status](https://travis-ci.org/kylewelsby/karma-jshint-preprocessor.svg)](https://travis-ci.org/kylewelsby/karma-jshint-preprocessor)

> Preprocessor / Plugin for Karma to check JavaScript syntax on the fly.

[![NPM Package Stats](https://nodei.co/npm/karma-jshint-preprocessor.png)](https://www.npmjs.org/package/karma-jshint-preprocessor)


## Installation

The easiest way is to keep `karma-jshint-preprocessor` as a devDependency in
your `package.json`.

```json
{
  "devDependencies": {
    "karma": "~0.10",
    "karma-jshint-preprocessor": "~0.1"
  }
}
```

You can simply do it by:

```bash
npm install karma-jshint-preprocessor --save-dev
```

## Usage

In your `karma.conf.js` file, specify the files you want to have lint'ed in the preprocessor section like this.

```javascript
...
preprocessors: {
  '*.js': ['jshint']
}
...
```


#### Optional jshintrc

Read an optional `jshintrc` property from the karma config to force a `.jshintrc` file to be used by jshint.

```javascript
module.exports = function (config) {
  config.set({
    // ...
    jshintPreprocessor: {
      jshintrc: './.jshintrc'
    },
    // ...
  });
};
```

*Thanks to [Kl0tl](https://github.com/Kl0tl) for adding jshintrc path support.*

JSHint configuration is read from a JSON formatted `.jshintrc` file within your project


#### Cancel build

Cancel the current build if a linting error has occurred. This can be useful on
CI servers.

```javascript
module.exports = function (config) {
  config.set({
    // ...
    jshintPreprocessor: {
      stopOnError: true
    },
    // ...
  });
};
```

##### Example `.jshintrc` file.

```json
{
    "undef": true,
    "globals": {
        "angular": true
    }
}
```

View the full list of [JSHint options][jshint options].

----

For more information on Karma see the [karma homepage].


[karma homepage]:http://karma-runner.github.com
[jshint options]:http://www.jshint.com/docs/options/
