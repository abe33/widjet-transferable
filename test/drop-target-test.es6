import expect from 'expect.js';
import sinon from 'sinon';
import jsdom from 'mocha-jsdom';
import widgets from 'widjet';
import {setPageContent, getTestRoot} from 'widjet-test-utils/dom';

import '../src/index';

describe('drop targets', () => {
  jsdom({url: 'http://localhost'});

  describe('without a handler method defined', () => {
    beforeEach(() => {
      setPageContent('<div data-drop></div>');
    });

    it('raises an exception', () => {
      expect(() => {
        widgets('drop-target', '[data-drop]', {on: 'init'});
      }).to.throwError();
    });
  });

  describe('with an undefined ondrop method', () => {
    beforeEach(() => {
      setPageContent('<div data-drop data-ondrop="foo"></div>');
    });

    it('raises an exception', () => {
      expect(() => {
        widgets('drop-target', '[data-drop]', {on: 'init'});
      }).to.throwError();
    });
  });

  describe('with an undefined onenter method', () => {
    beforeEach(() => {
      setPageContent('<div data-drop data-onenter="foo"></div>');
    });

    it('raises an exception', () => {
      expect(() => {
        widgets('drop-target', '[data-drop]', {on: 'init'});
      }).to.throwError();
    });
  });

  describe('with an undefined onleave method', () => {
    beforeEach(() => {
      setPageContent('<div data-drop data-onleave="foo"></div>');
    });

    it('raises an exception', () => {
      expect(() => {
        widgets('drop-target', '[data-drop]', {on: 'init'});
      }).to.throwError();
    });
  });

  describe('with a defined ondrop method', () => {
    let handler;

    beforeEach(() => {
      setPageContent('<div data-drop data-ondrop="handler"></div>');

      handler = sinon.spy();
    });

    it('creates a method on the element that calls that handler', () => {
      widgets('drop-target', '[data-drop]', {on: 'init', handler});

      const element = getTestRoot().querySelector('[data-drop]');

      element.drop();

      expect(handler.called).to.be.ok();
    });
  });

  describe('with a defined onenter method', () => {
    let handler;

    beforeEach(() => {
      setPageContent('<div data-drop data-onenter="handler"></div>');

      handler = sinon.spy();
    });

    it('creates a method on the element that calls that handler', () => {
      widgets('drop-target', '[data-drop]', {on: 'init', handler});

      const element = getTestRoot().querySelector('[data-drop]');

      element.enter();

      expect(handler.called).to.be.ok();
    });
  });

  describe('with a defined onleave method', () => {
    let handler;

    beforeEach(() => {
      setPageContent('<div data-drop data-onleave="handler"></div>');

      handler = sinon.spy();
    });

    it('creates a method on the element that calls that handler', () => {
      widgets('drop-target', '[data-drop]', {on: 'init', handler});

      const element = getTestRoot().querySelector('[data-drop]');

      element.leave();

      expect(handler.called).to.be.ok();
    });
  });
});
