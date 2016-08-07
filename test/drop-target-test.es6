import expect from 'expect.js'
import sinon from 'sinon'
import jsdom from 'mocha-jsdom'
import widgets from 'widjet'

import '../src/index'

describe('drop targets', () => {
  jsdom()

  describe('without a handler method defined', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div data-drop></div>'
    })

    it('raises an exception', () => {
      expect(() => {
        widgets('drop-target', '[data-drop]', {on: 'init'})
      }).to.throwError()
    })
  })

  describe('with an undefined handler method', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div data-drop data-handle="foo"></div>'
    })

    it('raises an exception', () => {
      expect(() => {
        widgets('drop-target', '[data-drop]', {on: 'init'})
      }).to.throwError()
    })
  })

  describe('with a defined handler method', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div data-drop data-handle="handler"></div>'

      window.handler = sinon.spy()
    })

    it('creates a method on the element that calls that handler', () => {
      widgets('drop-target', '[data-drop]', {on: 'init'})

      const element = document.querySelector('[data-drop]')

      element.dropHandle()

      expect(window.handler.called).to.be.ok()
    })
  })
})
