
const decache = require('decache');
const expect = require('ultimate-chai').expect;
const mock = require('mock-require');
const sinon = require('sinon');

let sandbox;
let originalArgv = process.argv.slice();

describe('index.js', () => {
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    // Decache so we can re-import:
    decache('../bin');
    // Restore the original process.argv:
    process.argv = originalArgv.slice();
    sandbox.restore();
  })
  context('testing index', () => {
    it('should call exec with command', (done) => {
      const execStub = sandbox.stub();
      mock('child_process', { exec: execStub });
      process.argv.push("--file=./test/basic.js");
      process.env.DEBUG = 'puppeteer-loadtest';

      const index = require('../bin');

      expect(execStub).to.have.been.called();
      expect(execStub).to.have.been.calledWith('node ./test/basic.js');
      done();
    });

    it('should call exec with command and id', (done) => {
      const execStub = sandbox.stub();
      mock('child_process', { exec: execStub });
      process.argv.push("--file=./test/basic.js");
      process.argv.push("--addId");
      process.env.DEBUG = 'puppeteer-loadtest';

      const index = require('../bin');

      expect(execStub).to.have.been.called();
      expect(execStub).to.have.been.calledWith('node ./test/basic.js 0');
      done();
    });
  });

});