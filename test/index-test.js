
const expect = require('ultimate-chai').expect;
const mock = require('mock-require');
const sinon = require('sinon');
const execStub = sinon.sandbox.create().stub();
mock('child_process', { exec: execStub });

process.argv.push("--file=./test/basic.js");
process.env.DEBUG = 'puppeteer-loadtest'; 
const index = require('../');


describe('index.js', () => {
  context('testing index', () => {
    it('should call exec with command', (done) => {
      expect(execStub).to.have.been.called();
      expect(execStub).to.have.been.calledWith('node ./test/basic.js');
      done();
    });
  });
});
  