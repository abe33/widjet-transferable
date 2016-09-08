import expect from 'expect.js'
import sinon from 'sinon'
import jsdom from 'mocha-jsdom'
import widgets from 'widjet'

import {asDataAttrs} from './helpers/utils'
import {mousedown, mousemove, mouseup, mouseover, mouseout, objectCenterCoordinates} from './helpers/events'

import '../src/index'

describe('drag source', () => {
  jsdom()

  let [dragSource, dropTarget, container, dragged] = []

  function buildDragContext (dropAttrs = {}, dragAttrs = {}, extraMarkup = '') {
    const dropTargetContent = dropAttrs.content || ''
    const dragSourceContent = dragAttrs.content || 'content'
    delete dropAttrs.content
    delete dragAttrs.content

    document.body.innerHTML = `
    <div class="container">
      <div data-drop ${asDataAttrs(dropAttrs)}>${dropTargetContent}</div>
      <div ${asDataAttrs(dragAttrs)}>${dragSourceContent}</div>
    </div>
    ${extraMarkup}
    `

    widgets('drop-target', '[data-drop]', {on: 'init'})
    widgets('drag-source', '[data-transferable]', {on: 'init'})

    container = document.querySelector('.container')
    dragSource = document.querySelector('[data-transferable]')
    dropTarget = document.querySelector('[data-drop]')
  }

  function getPlaceholder () {
    return dropTarget.querySelector('.dnd-placeholder')
  }
  function startDrag (source) {
    mousedown(source)
    mousemove(source, {x: 100, y: 100})

    dragged = document.querySelector('.dragged')
  }

  function dragOver (target, offsets = {x: 0, y: 0}) {
    const coords = objectCenterCoordinates(target)
    coords.x += offsets.x
    coords.y += offsets.y

    mousemove(dragged, coords)
    mouseover(target, coords)
    mousemove(target, coords)
  }

  function dragOut (target) {
    mousemove(dragged, {x: 1000, y: 1000})
    mouseout(target)
  }

  function drop () {
    mouseup(dragged)
  }

  function expectStartedDrag () {
    it('adds the dragged class on the drag source', () => {
      expect(dragged).not.to.be(null)
    })

    it('adds the dragging class on the drag container', () => {
      expect(document.body.classList.contains('dragging')).to.be.ok()
    })
  }

  function expectAcceptedDropTarget () {
    it('adds the accept-drop class on the drop target', () => {
      expect(dropTarget.classList.contains('accept-drop')).to.be.ok()
    })
  }

  function expectUnacceptedDropTarget () {
    it('does not add the accept-drop class on the drop target', () => {
      expect(dropTarget.classList.contains('accept-drop')).not.to.be.ok()
    })
  }

  function expectInitializedDrop () {
    it('adds the drop class on the drop target', () => {
      expect(dropTarget.classList.contains('drop')).to.be.ok()
    })

    it('adds a drag and drop placeholder in the drop target', () => {
      expect(getPlaceholder()).not.to.be(null)
    })
  }

  function expectDragEnded () {
    it('removes the dragged class on the drag source', () => {
      expect(dragged.classList.contains('dragged')).not.to.be.ok()
    })

    it('removes the dragging class on the body', () => {
      expect(document.body.classList.contains('dragging')).not.to.be.ok()
    })

    it('removes the classes on the drop target', () => {
      expect(dropTarget.classList.contains('drop')).not.to.be.ok()
      expect(dropTarget.classList.contains('accept-drop')).not.to.be.ok()
    })
  }
  function expectSucceedingDrop () {
    it('calls the drop handler function', () => {
      expect(window.handler.called).to.be.ok()
    })
  }

  function expectAbortedDrop () {
    it('does not call the drop handler function', () => {
      expect(window.handler.called).not.to.be.ok()
    })
  }

  beforeEach(() => {
    dragged = null
    document.body.classList.remove('dragging')

    widgets.release('drag-source')
    widgets.release('drop-target')

    window.handler = sinon.spy()
  })

  describe('dragging the source itself', () => {
    describe('without any flavors', () => {
      beforeEach(() => {
        buildDragContext({handle: 'handler'}, {transferable: 'foo'})
      })

      describe('starting a drag and drop gesture', () => {
        beforeEach(() => { startDrag(dragSource) })

        it('moves the drag source as a child of body', () => {
          expect(dragSource.parentNode).to.be(document.body)
        })

        expectStartedDrag()
        expectAcceptedDropTarget()

        describe('when hovering the drop target', () => {
          beforeEach(() => { dragOver(dropTarget) })

          expectInitializedDrop()

          describe('then releasing the mouse', () => {
            beforeEach(() => { drop() })

            expectDragEnded()
            expectSucceedingDrop()

            it('removes the drag and drop placeholder from the drop target', () => {
              expect(getPlaceholder()).to.be(null)
            })
          })

          describe('then leaving the drop target', () => {
            beforeEach(() => { dragOut(dropTarget) })

            it('removes the drop class on the drop target', () => {
              expect(dropTarget.classList.contains('drop')).not.to.be.ok()
            })

            it('removes the drag and drop placeholder from the drop target', () => {
              expect(getPlaceholder()).to.be(null)
            })

            describe('then releasing the mouse', () => {
              beforeEach(() => { drop() })

              expectDragEnded()
              expectAbortedDrop()

              it('restores the source in its original container', () => {
                expect(dragSource.parentNode).to.be(container)
              })
            })
          })
        })
      })
    })

    describe('with mismatching flavors', () => {
      beforeEach(() => {
        buildDragContext({
          handle: 'handler', flavors: '{foo}'
        }, {
          transferable: 'foo', flavors: '{bar}'
        })
      })

      describe('starting a drag and drop gesture', () => {
        beforeEach(() => { startDrag(dragSource) })

        expectStartedDrag()
        expectUnacceptedDropTarget()

        describe('when hovering the drop target', () => {
          beforeEach(() => { dragOver(dropTarget) })

          it('does not add the drop class on the drop target', () => {
            expect(dropTarget.classList.contains('drop')).not.to.be.ok()
          })

          it('does not add a drag and drop placeholder in the drop target', () => {
            expect(getPlaceholder()).to.be(null)
          })

          describe('then releasing the mouse', () => {
            beforeEach(() => { drop() })

            expectDragEnded()
            expectAbortedDrop()

            it('restores the source in its original container', () => {
              expect(dragSource.parentNode).to.be(container)
            })
          })
        })
      })
    })

    describe('with one matching flavors', () => {
      beforeEach(() => {
        buildDragContext({
          handle: 'handler', flavors: '{foo},{bar}'
        }, {
          transferable: 'foo', flavors: '{bar},{baz}'
        })
      })

      describe('starting a drag and drop gesture', () => {
        beforeEach(() => { startDrag(dragSource) })

        expectStartedDrag()
        expectAcceptedDropTarget()

        describe('when hovering the drop target', () => {
          beforeEach(() => { dragOver(dropTarget) })

          expectInitializedDrop()

          describe('then releasing the mouse', () => {
            beforeEach(() => { drop() })

            expectDragEnded()
            expectSucceedingDrop()
          })
        })
      })
    })
  })

  describe('dragging a source with the data-keep attribute', () => {
    beforeEach(() => {
      buildDragContext({handle: 'handler'}, {transferable: 'foo', keep: 1})
      startDrag(dragSource)
    })

    it('clones the source', () => {
      expect(dragged).not.to.be(dragSource)
      expect(dragged.nodeName).to.eql(dragSource.nodeName)
      expect(dragged.textContent).to.eql(dragSource.textContent)
    })
  })

  describe('with the data-grip attribute', () => {
    let grip
    beforeEach(() => {
      buildDragContext({handle: 'handler'}, {transferable: 'foo', content: '<div class="grip"></div>', grip: '.grip'})

      grip = document.querySelector('.grip')
    })

    describe('dragging the source', () => {
      it('does not start the drag', () => {
        startDrag(dragSource)

        expect(dragged).to.be(null)
        expect(document.body.classList.contains('dragging')).not.to.be.ok()
      })
    })

    describe('dragging the grip', () => {
      beforeEach(() => { startDrag(grip) })

      expectStartedDrag()
    })
  })

  describe('dragging a source with the data-image-source attribute', () => {
    let originalSource
    beforeEach(() => {
      buildDragContext({
        handle: 'handler'
      }, {
        transferable: 'foo', 'image-source': '.source'
      }, '<div class="source"></div>')

      originalSource = document.querySelector('.source')

      startDrag(dragSource)
    })

    it('clones the provided image source', () => {
      expect(dragged).not.to.be(dragSource)
      expect(dragged).not.to.be(originalSource)
      expect(dragged.nodeName).to.eql('DIV')
      expect(dragged.classList.contains('source')).to.be.ok()
    })
  })

  describe('dragging a source with the data-image attribute', () => {
    beforeEach(() => {
      buildDragContext({
        handle: 'handler'
      }, {
        transferable: 'foo', image: '<div class=\'source\'></div>'
      })

      startDrag(dragSource)
    })

    it('clones the provided image source', () => {
      expect(dragged).not.to.be(dragSource)
      expect(dragged.nodeName).to.eql('DIV')
      expect(dragged.classList.contains('source')).to.be.ok()
    })
  })
})
