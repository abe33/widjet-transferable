import expect from 'expect.js'
import sinon from 'sinon'
import jsdom from 'mocha-jsdom'
import widgets from 'widjet'

import '../src/index'

describe('drop targets', () => {
  jsdom()

  describe('without a ondrop method defined', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div data-drop></div>'
    })

    it('raises an exception', () => {
      expect(() => {
        widgets('drop-target', '[data-drop]', {on: 'init'})
      }).to.throwError()
    })
  })

  describe('with an undefined ondrop method', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div data-drop data-ondrop="foo"></div>'
    })

    it('raises an exception', () => {
      expect(() => {
        widgets('drop-target', '[data-drop]', {on: 'init'})
      }).to.throwError()
    })
  })

  describe('with a defined ondrop method', () => {
    let handler

    beforeEach(() => {
      document.body.innerHTML = '<div data-drop data-ondrop="handler"></div>'

      handler = sinon.spy()
    })

    it('creates a method on the element that calls that handler', () => {
      widgets('drop-target', '[data-drop]', {on: 'init', handler})

      const element = document.querySelector('[data-drop]')

      element.drop()

      expect(handler.called).to.be.ok()
    })
  })
})
