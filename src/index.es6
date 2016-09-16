import widgets from 'widjet'
import {asArray, cloneNode, getNode, nodeIndex, detachNode} from 'widjet-utils'
import {CompositeDisposable, DisposableEvent} from 'widjet-disposables'

const ANY_FLAVOR = '{all}'
const isAnyFlavor = f => f === ANY_FLAVOR

widgets.define('drop-target', (el) => {
  const handler = window[el.getAttribute('data-handle')]

  if (!handler) {
    throw new Error('Cannot create a drop target without a handler function')
  }

  el.dropHandle = (...args) => { handler.call(el, ...args) }
})

widgets.define('drag-source', (el, options = {}) => {
  let dragged
  let dragging
  let dragOffset
  let originalIndex
  let originalParent
  let originalPos
  let placeholder
  let potentialTargets
  let potentialTargetsSubscriptions
  let target
  let windowSubscriptions

  const dropSelector = options.dropSelector || '[data-drop]'
  const targetContainer = options.targetContainer || document
  const draggedContainer = options.draggedContainer || document
  const excludedChildrenClasses = ['.dnd-placeholder'].concat(options.excludedChildrenClasses || [])

  const transferableImageSourceQuery = el.getAttribute('data-image-source')
  const transferableImageSource = transferableImageSourceQuery
    ? draggedContainer.querySelector(transferableImageSourceQuery)
    : null

  const transferableImage = (el.hasAttribute('data-image'))
    ? getNode(el.getAttribute('data-image'))
    : null

  const keepSource = el.getAttribute('data-keep')
  const noDragOffset = el.hasAttribute('data-no-drag-offset')
  const flavors = getFlavors(el)
  const transferable = el.getAttribute('data-transferable').toString()
  const gripSelector = el.getAttribute('data-grip')
  const grip = gripSelector ? el.querySelector(gripSelector) : el
  const placeholderContent = getPlaceholderContent(el)
  const legitChildren = legitChildrenFilter(excludedChildrenClasses)

  const startDrag = (e) => {
    const targetSelector = flavors.some(isAnyFlavor)
      ? dropSelector
      : flavors.map(f => `${dropSelector}[data-flavors*='${f}']`).join(',')

    originalPos = el.getBoundingClientRect()
    originalParent = el.parentNode
    originalIndex = nodeIndex(el)

    dragging = true
    dragOffset = {
      x: originalPos.left - e.pageX,
      y: originalPos.top - e.pageY
    }

    dragged = transferableImage || (transferableImageSource
      ? cloneNode(transferableImageSource)
      : (keepSource ? cloneNode(el) : el)
    )

    if (!transferableImage && !transferableImageSource) {
      dragged.style.width = el.clientWidth + 'px'
    }

    dragged.style.position = 'absolute'
    dragged.classList.add('dragged')

    draggedContainer.body.appendChild(dragged)
    draggedContainer.body.classList.add('dragging')

    if (transferableImageSource || transferableImage) { detachNode(el) }

    placeholder = getPlaceholder(placeholderContent)
    potentialTargets = asArray(targetContainer.querySelectorAll(targetSelector))

    potentialTargetsSubscriptions = new CompositeDisposable()

    potentialTargets.forEach((potentialTarget) => {
      potentialTarget.classList.add('accept-drop')

      potentialTargetsSubscriptions.add(new DisposableEvent(potentialTarget, 'mouseover', (e) => {
        potentialTarget.classList.add('drop')
        potentialTarget.appendChild(placeholder)

        const horizontalDrag = potentialTarget.hasAttribute('data-horizontal-drag')

        const find = positionFinder({
          placeholder,
          horizontalDrag,
          target: potentialTarget
        })

        const potentialTargetSubscription = new CompositeDisposable([
          new DisposableEvent(potentialTarget, 'mousemove', (e) => {
            let {pageY: y, pageX: x} = e

            y -= targetContainer.defaultView.scrollY
            x -= targetContainer.defaultView.scrollX
            target = potentialTarget

            legitChildren(target.children).some(find(x, y))
          }),

          new DisposableEvent(potentialTarget, 'mouseout', (e) => {
            detachNode(placeholder)
            potentialTarget.classList.remove('drop')
            potentialTargetSubscription.dispose()
            target = null
          })
        ])
      }))
    })
  }

  const stopDrag = (e) => {
    draggedContainer.body.classList.remove('dragging')
    potentialTargets.forEach(n => n.classList.remove('accept-drop'))

    if (target != null) {
      const targetIndex = nodeIndex(placeholder)
      const dropFlavor = getFlavors(target)

      const matchedFlavors = isAnyFlavor(dropFlavor[0])
        ? flavors
        : flavors.filter(f => dropFlavor.indexOf(f) !== -1)

      if (keepSource || transferableImageSource || transferableImage) {
        detachNode(dragged)
      } else {
        dragged.classList.remove('dragged')
        dragged.setAttribute('style', '')
      }

      target.classList.remove('drop')
      target.dropHandle(transferable, matchedFlavors, targetIndex, el)
      detachNode(placeholder)
    } else {
      detachNode(placeholder)

      if (keepSource) {
        detachNode(dragged)
      } else if (originalParent) {
        if (transferableImageSource || transferableImage) {
          detachNode(dragged)
        }

        const next = originalParent.children[originalIndex]

        originalParent.insertBefore(el, next)

        el.classList.remove('dragged')
        el.setAttribute('style', '')
      }
    }
  }

  const drag = (e) => {
    let {pageX: x, pageY: y} = e

    if (!noDragOffset) {
      x += dragOffset.x
      y += dragOffset.y
    }

    dragged.style.left = x + 'px'
    dragged.style.top = y + 'px'
  }

  return new DisposableEvent(grip, 'mousedown', (e) => {
    e.stopImmediatePropagation()
    e.stopPropagation()
    e.preventDefault()

    const start = {x: e.pageX, y: e.pageY}

    windowSubscriptions = new CompositeDisposable([
      new DisposableEvent(draggedContainer.defaultView, 'mouseup', (e) => {
        e.stopImmediatePropagation()
        if (dragging) {
          stopDrag(e)
          dragging = false
        }

        windowSubscriptions.dispose()
        potentialTargetsSubscriptions && potentialTargetsSubscriptions.dispose()
      }),
      new DisposableEvent(draggedContainer.defaultView, 'mousemove', (e) => {
        e.stopImmediatePropagation()
        if (!dragging) {
          let difX = e.pageX - start.x
          let difY = e.pageY - start.y

          if (Math.abs(Math.sqrt((difX * difX) + (difY * difY))) > 10) {
            startDrag(e)
            drag(e)
          }
        } else {
          drag(e)
        }
      })
    ])
  })
})

function getFlavors (el) {
  return (el.getAttribute('data-flavors') || ANY_FLAVOR).split(',')
}

function getPlaceholder (content) {
  return getNode(`<div class='dnd-placeholder'>${content}</div>`)
}

function getPlaceholderContent (el) {
  const dndPlaceholder = el.getAttribute('data-dnd-placeholder')

  if (dndPlaceholder) {
    switch (dndPlaceholder) {
      case 'clone': return el.outerHTML
      default:
        const placeholderElement = document.querySelector(dndPlaceholder)
        if (placeholderElement) { return placeholderElement.outerHTML }
    }
  }
  return ''
}

function legitChildrenFilter (excludedChildrenClasses) {
  const sel = excludedChildrenClasses.map(c => `:not(${c})`).join('')
  return children => asArray(children).filter(child => child.matches(sel))
}

function positionFinder ({target, horizontalDrag, placeholder}) {
  return function (pageX, pageY) {
    return function (child, i, children) {
      const nextChild = children[i + 1]

      const {
        top: childTop,
        left: childLeft,
        height: childHeight,
        width: childWidth
      } = child.getBoundingClientRect()

      const childHalfHeight = childTop + (childHeight / 2)
      const childHalfWidth = childLeft + (childWidth / 2)

      const shouldInsertBefore = horizontalDrag
      ? pageX < childHalfWidth
      : pageY < childHalfHeight

      const shouldInsertAtEnd = horizontalDrag
      ? pageX >= childHalfWidth
      : pageY >= childHalfHeight

      if (shouldInsertBefore) {
        target.insertBefore(placeholder, child)
        return true
      } else if (nextChild) {
        const {
          top: nextChildTop,
          left: nextChildLeft,
          height: nextChildHeight,
          width: nextChildWidth
        } = nextChild.getBoundingClientRect()

        const nextChildHalfHeight = nextChildTop + (nextChildHeight / 2)
        const nextChildHalfWidth = nextChildLeft + (nextChildWidth / 2)

        const shouldInsertBeforeNextChild = horizontalDrag
        ? pageX >= childHalfWidth && pageX <= nextChildHalfWidth
        : pageY >= childHalfHeight && pageY <= nextChildHalfHeight

        if (shouldInsertBeforeNextChild) {
          target.insertBefore(placeholder, nextChild)
          return true
        }
      } else if (!nextChild && shouldInsertAtEnd) {
        target.appendChild(placeholder)
      }
    }
  }
}
