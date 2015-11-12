/* eslint-env node, mocha */
"use strict";
var jshint = require("../index");
var assert = require('chai').assert;
var fs = require("fs");
var path = require("path");

var File = function(path, mtime) {
  this.path = path;
  this.originalPath = path;
  this.contentPath = path;
  this.mtime = mtime;
  this.isUrl = false;
};
var errors = [];
var logger = {
  create: function() {
    return {
      debug: function() {},
      error: function(error) {
        errors.push(error);
      }
    };
  }
};

function createPreprocessor(config) {
  if (!config) {
    config = {};
  }
  return jshint["preprocessor:jshint"][1](logger, config);
}

describe("Karma JSHint Preprocessor", function() {
  beforeEach(function() {
    errors = [];
  });

  afterEach(function() {
    errors = [];
  });

  it("allows simply detects syntax error", function(done) {
    var file = new File("/base/path/file.js");
    createPreprocessor()("var greeting = \"hello world\"", file, function() {
      assert.include(errors[0], "Missing semicolon.", "Missing semicolon");
      done();
    });
  });

  describe("config.jshintrc", function() {
    it("reads from default file", function(done) {
      var file = new File("/base/path/file.js");
      var configFile = path.join(__dirname, ".jshintrc");
      fs.writeFile(configFile, JSON.stringify({
        undef: true
      }, null, 2), function(err) {
        if (err) {
          throw err;
        }
      });

      createPreprocessor({
        jshintrc: configFile
      })("greeting = \"hello world\";", file, function() {
        assert.include(errors[0], "'greeting' is not defined.", "Undfined Variable error");
        done();
      });
    });
  });

  describe("config.stopOnError", function(){
    it("stops on error", function(done){
      var file = new File("/base/path/file.js");
      createPreprocessor({
        stopOnError: true
      })("var greeting = \"hello world\"", file, function(returnedErrors) {
        assert.ok(returnedErrors, "returns a value that breaks the done routine");
        done();
      });
    });
  });
});
