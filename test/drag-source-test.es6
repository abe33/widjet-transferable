import expect from 'expect.js'
import sinon from 'sinon'
import jsdom from 'mocha-jsdom'
import widgets from 'widjet'
import {nodeIndex, merge} from 'widjet-utils'

import {asDataAttrs} from './helpers/utils'
import {mousedown, mousemove, mouseup, mouseover, mouseout, objectCenterCoordinates} from './helpers/events'

import '../src/index'

describe('drag source', () => {
  jsdom()

  let [dragSource, dropTarget, container, dragged, handler] = []

  function buildDragContext (dropAttrs = {}, dragAttrs = {}, {extraMarkup, extraDragOptions, extraDropOptions} = {}) {
    const dropSelector = dropAttrs.selector || '[data-drop]'
    const dropTargetContent = dropAttrs.content || ''
    delete dropAttrs.selector
    delete dropAttrs.content

    const dragSelector = dragAttrs.selector || '[data-transferable]'
    const dragSourceContent = dragAttrs.content || 'content'
    delete dragAttrs.selector
    delete dragAttrs.content

    document.body.innerHTML = `
    <div class="container">
      <div data-drop ${asDataAttrs(dropAttrs)}>${dropTargetContent}</div>
      <div ${asDataAttrs(dragAttrs)}>${dragSourceContent}</div>
    </div>
    ${extraMarkup || ''}
    `

    handler = sinon.spy()

    widgets('drop-target', dropSelector, merge({on: 'init', handler}, extraDropOptions || {}))
    widgets('drag-source', dragSelector, merge({on: 'init'}, extraDragOptions || {}))

    container = document.querySelector('.container')
    dragSource = document.querySelector(dragSelector)
    dropTarget = document.querySelector(dropSelector)
  }

  function getPlaceholder () {
    return dropTarget.querySelector('.dnd-placeholder')
  }

  function getBox (top, left, width, height) {
    return {
      top, left,
      width, height,
      right: top + width,
      bottom: top + height
    }
  }

  function withFakeBoundingClientRects (mode) {
    let safeGetBoundingClientRect
    beforeEach(() => {
      safeGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
      window.HTMLElement.prototype.getBoundingClientRect = function () {
        const width = 100
        const height = 100
        if (this.hasAttribute('data-transferable')) {
          if (this.style.top) {
            const top = parseInt(this.style.top, 10)
            const left = parseInt(this.style.left, 10)

            return getBox(top, left, width, height)
          } else {
            return getBox(0, 0, width, height)
          }
        } else if (this.classList.contains('block') || this.classList.contains('dnd-placeholder')) {
          const index = nodeIndex(this)

          if (mode === 'horizontal') {
            return getBox(0, index * width, width, height)
          } else {
            return getBox(index * height, 0, width, height)
          }
        } else {
          const length = this.children.length

          if (mode === 'horizontal') {
            return getBox(0, 0, length * width, height)
          } else {
            return getBox(0, 0, width, length * height)
          }
        }
      }
    })
    afterEach(() => {
      window.HTMLElement.prototype.getBoundingClientRect = safeGetBoundingClientRect
    })
  }

  function startDrag (source) {
    mousedown(source)
    mousemove(source, {x: 100, y: 100})

    dragged = document.querySelector('.dragged')
  }

  function dragOver (target, offsets = {}) {
    const center = objectCenterCoordinates(target)
    const coords = {
      x: offsets.x != null ? offsets.x : center.x,
      y: offsets.y != null ? offsets.y : center.y
    }

    mousemove(dragged, coords)
    mouseover(target, coords)
    mousemove(target, coords)
  }

  function drag (target, offsets = {}) {
    const center = objectCenterCoordinates(target)
    const coords = {
      x: offsets.x != null ? offsets.x : center.x,
      y: offsets.y != null ? offsets.y : center.y
    }

    mousemove(dragged, coords)
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
      expect(handler.called).to.be.ok()
    })
  }

  function expectAbortedDrop () {
    it('does not call the drop handler function', () => {
      expect(handler.called).not.to.be.ok()
    })
  }

  beforeEach(() => {
    dragged = null
    document.body.classList.remove('dragging')

    widgets.release('drag-source')
    widgets.release('drop-target')
  })

  describe('dragging the source itself', () => {
    describe('without any flavors', () => {
      withFakeBoundingClientRects('vertical')

      beforeEach(() => {
        buildDragContext({ondrop: 'handler'}, {transferable: 'foo'})
      })

      describe('starting a drag and drop gesture', () => {
        beforeEach(() => {
          startDrag(dragSource)
          mousemove(dragSource, {x: 150, y: 150})
        })

        expectStartedDrag()
        expectAcceptedDropTarget()

        it('moves the drag source as a child of body', () => {
          expect(dragSource.parentNode).to.be(document.body)
        })

        it('moves the dragged element', () => {
          expect(dragged.style.top).to.eql('50px')
          expect(dragged.style.left).to.eql('50px')
        })

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
          ondrop: 'handler',
          flavors: '{foo}'
        }, {
          transferable: 'foo',
          flavors: '{bar}'
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
          ondrop: 'handler',
          flavors: '{foo},{bar}'
        }, {
          transferable: 'foo',
          flavors: '{bar},{baz}'
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

    describe('with a custom transferable function', () => {
      let transferableFunction
      beforeEach(() => {
        transferableFunction = sinon.spy()

        buildDragContext({
          ondrop: 'handler',
          flavors: '{foo},{bar}'
        }, {
          transferable: 'function:getTransferable',
          flavors: '{bar},{baz}'
        }, {
          extraDragOptions: {getTransferable: transferableFunction}
        })
      })

      it('calls the specified function to get the transferable data', () => {
        startDrag(dragSource)
        dragOver(dropTarget)
        drop()

        expect(transferableFunction.calledWith(dragSource, ['{bar}'])).to.be.ok()
        expect(handler.calledWith(undefined, ['{bar}'], 0, dragSource)).to.be.ok()
      })
    })

    describe('with no transferable data', () => {
      beforeEach(() => {
        buildDragContext({
          ondrop: 'handler'
        }, {
          selector: '[data-source]',
          source: 'foo'
        })
      })

      it('still allows to perform a drag and drop', () => {
        startDrag(dragSource)
        dragOver(dropTarget)
        drop()

        expect(handler.calledWith(null, ['{all}'], 0, dragSource)).to.be.ok()
      })
    })

    describe('with a custom transferable attribute', () => {
      beforeEach(() => {
        buildDragContext({
          ondrop: 'handler'
        }, {
          selector: '[data-source]',
          source: 'foo'
        }, {
          extraDragOptions: { transferableSource: 'data-source' }
        })
      })

      it('still allows to perform a drag and drop', () => {
        startDrag(dragSource)
        dragOver(dropTarget)
        drop()

        expect(handler.calledWith('foo', ['{all}'], 0, dragSource)).to.be.ok()
      })
    })
  })

  describe('with the data-no-drag-offset attribute', () => {
    withFakeBoundingClientRects('vertical')

    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        'no-drag-offset': true
      })
    })

    describe('starting a drag and drop gesture', () => {
      beforeEach(() => {
        startDrag(dragSource)
        mousemove(dragSource, {x: 150, y: 150})
      })

      it('moves the dragged element', () => {
        expect(dragged.style.top).to.eql('150px')
        expect(dragged.style.left).to.eql('150px')
      })
    })
  })

  describe('with the data-lock-x attribute', () => {
    withFakeBoundingClientRects('vertical')

    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        'lock-x': true
      })
    })

    describe('starting a drag and drop gesture', () => {
      beforeEach(() => {
        startDrag(dragSource)
        mousemove(dragSource, {x: 150, y: 150})
      })

      it('moves the dragged element only on the y axis', () => {
        expect(dragged.style.top).to.eql('50px')
        expect(dragged.style.left).to.be('')
      })
    })
  })

  describe('with the data-lock-y attribute', () => {
    withFakeBoundingClientRects('vertical')

    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        'lock-y': true
      })
    })

    describe('starting a drag and drop gesture', () => {
      beforeEach(() => {
        startDrag(dragSource)
        mousemove(dragSource, {x: 150, y: 150})
      })

      it('moves the dragged element only on the x axis', () => {
        expect(dragged.style.top).to.eql('')
        expect(dragged.style.left).to.be('50px')
      })
    })
  })

  describe('with the data-grip attribute', () => {
    let grip
    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        content: '<div class="grip"></div>',
        grip: '.grip'
      })

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

  describe('dragging a source with the data-keep-source attribute', () => {
    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        'keep-source': true
      })
      startDrag(dragSource)
    })

    it('clones the source', () => {
      expect(dragged).not.to.be(dragSource)
      expect(dragged.nodeName).to.eql(dragSource.nodeName)
      expect(dragged.textContent).to.eql(dragSource.textContent)
    })
  })

  describe('dragging a source with the data-image-source attribute', () => {
    let originalSource
    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        'image-source': '.source'
      }, {
        extraMarkup: '<div class="source"></div>'
      })

      originalSource = document.querySelector('.source')

      startDrag(dragSource)
    })

    it('removes the source from the DOM', () => {
      expect(dragSource.parentNode).to.be(null)
    })

    it('clones the provided image source', () => {
      expect(dragged).not.to.be(dragSource)
      expect(dragged).not.to.be(originalSource)
      expect(dragged.nodeName).to.eql('DIV')
      expect(dragged.classList.contains('source')).to.be.ok()
    })

    describe('aborting the drag gesture', () => {
      beforeEach(() => { drop() })

      it('put back the source in the DOM', () => {
        expect(dragSource.parentNode).not.to.be(null)
      })
    })
  })

  describe('dragging a source with the data-keep-source and data-image-source attributes', () => {
    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        'keep-source': true,
        'image-source': '.source'
      }, {
        extraMarkup: '<div class="source"></div>'
      })
      startDrag(dragSource)
    })

    it('does not remove the source from the DOM', () => {
      expect(dragSource.parentNode).not.to.be(null)
    })

    it('clones the provided image source', () => {
      expect(dragged).not.to.be(dragSource)
      expect(dragged.nodeName).to.eql('DIV')
      expect(dragged.classList.contains('source')).to.be.ok()
    })
  })

  describe('dragging a source with the data-image attribute', () => {
    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        image: '<div class=\'source\'></div>'
      })

      startDrag(dragSource)
    })

    it('removes the source from the DOM', () => {
      expect(dragSource.parentNode).to.be(null)
    })

    it('clones the provided image source', () => {
      expect(dragged).not.to.be(dragSource)
      expect(dragged.nodeName).to.eql('DIV')
      expect(dragged.classList.contains('source')).to.be.ok()
    })

    describe('aborting the drag gesture', () => {
      beforeEach(() => { drop() })

      it('put back the source in the DOM', () => {
        expect(dragSource.parentNode).not.to.be(null)
      })
    })
  })

  describe('dragging a source with the data-keep-source and data-image attributes', () => {
    beforeEach(() => {
      buildDragContext({
        ondrop: 'handler'
      }, {
        transferable: 'foo',
        'keep-source': true,
        image: '<div class=\'source\'></div>'
      })

      startDrag(dragSource)
    })

    it('does not remove the source from the DOM', () => {
      expect(dragSource.parentNode).not.to.be(null)
    })

    it('clones the provided image source', () => {
      expect(dragged).not.to.be(dragSource)
      expect(dragged.nodeName).to.eql('DIV')
      expect(dragged.classList.contains('source')).to.be.ok()
    })
  })

  describe('dragging a source with a data-dnd-placeholder attribute', () => {
    describe('set to clone', () => {
      beforeEach(() => {
        buildDragContext({
          ondrop: 'handler'
        }, {
          transferable: 'foo',
          'dnd-placeholder': 'clone'
        })

        startDrag(dragSource)
        dragOver(dropTarget)
      })

      it('clones the provided image source', () => {
        expect(getPlaceholder().innerHTML).to.eql('<div data-transferable="foo" data-dnd-placeholder="clone" class="drag-source-handled">content</div>')
      })
    })

    describe('set to a selector', () => {
      beforeEach(() => {
        buildDragContext({
          ondrop: 'handler'
        }, {
          transferable: 'foo',
          'dnd-placeholder': '.source'
        }, {
          extraMarkup: '<div class="source"></div>'
        })

        startDrag(dragSource)
        dragOver(dropTarget)
      })

      it('clones the provided element', () => {
        expect(getPlaceholder().innerHTML).to.eql('<div class="source"></div>')
      })
    })

    describe('set to a javascript function', () => {
      let placeholderHandle
      beforeEach(() => {
        placeholderHandle = sinon.spy()
        buildDragContext({
          ondrop: 'handler',
          flavors: '{foo},{bar}'
        }, {
          transferable: 'foo',
          flavors: '{baz},{bar}',
          'dnd-placeholder': 'function:placeholderHandle'
        }, {
          extraMarkup: '<div class="source"></div>',
          extraDragOptions: {placeholderHandle}
        })

        startDrag(dragSource)
        dragOver(dropTarget)
      })

      it('calls the function with the drag source and drop target', () => {
        expect(placeholderHandle.calledWith(dragSource, dropTarget, ['{bar}'])).to.be(true)
      })
    })
  })

  describe('dragging gesture', () => {
    describe('in a vertical layout container', () => {
      withFakeBoundingClientRects('vertical')

      beforeEach(() => {
        buildDragContext({
          ondrop: 'handler',
          content: '<div class="block"></div><div class="block"></div>'
        }, {
          transferable: 'foo'
        })

        startDrag(dragSource)
      })

      describe('when the mouse is above the upper half of the first child', () => {
        it('inserts the placeholder before the first child', () => {
          dragOver(dropTarget, {x: 50, y: 10})

          expect(nodeIndex(getPlaceholder())).to.eql(0)
        })
      })

      describe('when the mouse is above the lower half of a container child', () => {
        it('inserts the placeholder after the child', () => {
          dragOver(dropTarget, {x: 50, y: 60})

          expect(nodeIndex(getPlaceholder())).to.eql(1)
        })
      })

      describe('when the mouse is above the upper half of the last child', () => {
        it('inserts the placeholder before the last child', () => {
          dragOver(dropTarget, {x: 50, y: 110})

          expect(nodeIndex(getPlaceholder())).to.eql(1)
        })
      })

      describe('when the mouse is above the lower half of the last child', () => {
        it('inserts the placeholder after the last child', () => {
          dragOver(dropTarget, {x: 50, y: 160})

          expect(nodeIndex(getPlaceholder())).to.eql(2)
        })
      })

      describe('when the mouse is above the placeholder', () => {
        it('does not change the placeholder position', () => {
          dragOver(dropTarget, {x: 50, y: 60})
          expect(nodeIndex(getPlaceholder())).to.eql(1)

          drag(dropTarget, {x: 50, y: 110})
          expect(nodeIndex(getPlaceholder())).to.eql(1)

          drag(dropTarget, {x: 50, y: 210})
          expect(nodeIndex(getPlaceholder())).to.eql(1)

          drag(dropTarget, {x: 50, y: 260})
          expect(nodeIndex(getPlaceholder())).to.eql(2)
        })
      })
    })

    describe('in a horizontal layout container', () => {
      withFakeBoundingClientRects('horizontal')

      beforeEach(() => {
        buildDragContext({
          ondrop: 'handler',
          content: '<div class="block"></div><div class="block"></div>',
          'horizontal-drag': true
        }, {
          transferable: 'foo'
        })

        startDrag(dragSource)
      })

      describe('when the mouse is above the left half of the first child', () => {
        it('inserts the placeholder before the first child', () => {
          dragOver(dropTarget, {y: 50, x: 10})

          expect(nodeIndex(getPlaceholder())).to.eql(0)
        })
      })

      describe('when the mouse is above the right half of a container child', () => {
        it('inserts the placeholder after the child', () => {
          dragOver(dropTarget, {y: 50, x: 60})

          expect(nodeIndex(getPlaceholder())).to.eql(1)
        })
      })

      describe('when the mouse is above the left half of the last child', () => {
        it('inserts the placeholder before the last child', () => {
          dragOver(dropTarget, {y: 50, x: 110})

          expect(nodeIndex(getPlaceholder())).to.eql(1)
        })
      })

      describe('when the mouse is above the right half of the last child', () => {
        it('inserts the placeholder after the last child', () => {
          dragOver(dropTarget, {y: 50, x: 160})

          expect(nodeIndex(getPlaceholder())).to.eql(2)
        })
      })

      describe('when the mouse is above the placeholder', () => {
        it('does not change the placeholder position', () => {
          dragOver(dropTarget, {y: 50, x: 60})
          expect(nodeIndex(getPlaceholder())).to.eql(1)

          drag(dropTarget, {y: 50, x: 110})
          expect(nodeIndex(getPlaceholder())).to.eql(1)

          drag(dropTarget, {y: 50, x: 210})
          expect(nodeIndex(getPlaceholder())).to.eql(1)

          drag(dropTarget, {y: 50, x: 260})
          expect(nodeIndex(getPlaceholder())).to.eql(2)
        })
      })
    })
  })
})
