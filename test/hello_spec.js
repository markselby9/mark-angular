var hello = require('../src/hello');
describe("hello", function(){
    it("says hello", function(){
        expect(hello.sayHello()).toBe("helloworld");
    });
});