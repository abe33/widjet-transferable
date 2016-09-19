import widgets from 'widjet'
import {asArray, cloneNode, getNode, nodeIndex, detachNode} from 'widjet-utils'
import {CompositeDisposable, DisposableEvent} from 'widjet-disposables'

const ANY_FLAVOR = '{all}'
const isAnyFlavor = f => f === ANY_FLAVOR

widgets.define('drop-target', (el, options) => {
  const handler = options[el.getAttribute('data-ondrop')]

  if (!handler) {
    throw new Error('Cannot create a drop target without a ondrop function')
  }

  el.drop = (...args) => { handler.call(el, ...args) }
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
  const dropContainer = options.dropContainer || document
  const dragContainer = options.dragContainer || document

  const filterChildren = legitChildrenFilter(options)

  const flavors = getFlavors(el)
  const targetSelector = flavors.some(isAnyFlavor)
    ? dropSelector
    : flavors.map(f => `${dropSelector}[data-flavors*='${f}']`).join(',')

  const keepSource = el.getAttribute('data-keep')
  const noDragOffset = el.hasAttribute('data-no-drag-offset')
  const gripSelector = el.getAttribute('data-grip')
  const grip = gripSelector ? el.querySelector(gripSelector) : el
  const placeholderContent = getPlaceholderContent(el, options)

  const startDrag = (e) => {
    originalPos = el.getBoundingClientRect()
    originalParent = el.parentNode
    originalIndex = nodeIndex(el)

    dragged = getDraggedElement(el, dragContainer)
    dragging = true
    dragOffset = {
      x: originalPos.left - e.pageX,
      y: originalPos.top - e.pageY
    }

    dragContainer.body.appendChild(dragged)
    dragContainer.body.classList.add('dragging')

    if (hasTransferableImage(el)) { detachNode(el) }

    potentialTargets = asArray(dropContainer.querySelectorAll(targetSelector))

    potentialTargetsSubscriptions = new CompositeDisposable()

    potentialTargets.forEach((potentialTarget) => {
      potentialTarget.classList.add('accept-drop')

      potentialTargetsSubscriptions.add(new DisposableEvent(potentialTarget, 'mouseover', (e) => {
        placeholder = getPlaceholder(typeof placeholderContent === 'function'
          ? placeholderContent(el, potentialTarget, matchingFlavors(flavors, potentialTarget))
          : placeholderContent
        )

        potentialTarget.classList.add('drop')
        potentialTarget.appendChild(placeholder)

        const findPosition = positionFinder({
          placeholder,
          horizontalDrag: potentialTarget.hasAttribute('data-horizontal-drag'),
          target: potentialTarget
        })

        const potentialTargetSubscription = new CompositeDisposable([
          new DisposableEvent(potentialTarget, 'mousemove', (e) => {
            let {pageY: y, pageX: x} = e

            y -= dropContainer.defaultView.scrollY
            x -= dropContainer.defaultView.scrollX
            target = potentialTarget

            filterChildren(target.children).some(findPosition(x, y))
          }),

          new DisposableEvent(potentialTarget, 'mouseout', (e) => {
            detachNode(placeholder)
            potentialTarget.classList.remove('drop')
            potentialTargetSubscription.dispose()
            target = null
            placeholder = null
          })
        ])
      }))
    })
  }

  const stopDrag = (e) => {
    dragContainer.body.classList.remove('dragging')
    potentialTargets.forEach(n => n.classList.remove('accept-drop'))

    if (target != null) {
      const targetIndex = nodeIndex(placeholder)

      if (keepSource || hasTransferableImage(el)) {
        detachNode(dragged)
      } else {
        dragged.classList.remove('dragged')
        dragged.setAttribute('style', '')
      }

      target.classList.remove('drop')
      if (target.drop) {
        const matchedFlavors = matchingFlavors(flavors, target)
        target.drop(
          getTransferable(el, options, matchedFlavors),
          matchedFlavors,
          targetIndex,
          el
        )
      }

      detachNode(placeholder)
      placeholder = null
      target = null
    } else {
      if (keepSource) {
        detachNode(dragged)
      } else if (originalParent) {
        if (hasTransferableImage(el)) { detachNode(dragged) }

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
      new DisposableEvent(dragContainer.defaultView, 'mouseup', (e) => {
        e.stopImmediatePropagation()
        if (dragging) {
          stopDrag(e)
          dragging = false
        }

        windowSubscriptions.dispose()
        potentialTargetsSubscriptions && potentialTargetsSubscriptions.dispose()
      }),
      new DisposableEvent(dragContainer.defaultView, 'mousemove', (e) => {
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

function getTransferable (source, options, flavors) {
  const transferable = source.getAttribute('data-transferable') || ''

  if (transferable.indexOf('function:') === 0) {
    const transferableFunction = options[transferable.split(':')[1]]
    return typeof transferableFunction === 'function'
    ? transferableFunction(source, flavors)
    : null
  } else {
    return transferable
  }
}

function getFlavors (source) {
  return (source.getAttribute('data-flavors') || ANY_FLAVOR).split(',')
}

function matchingFlavors (flavors, target) {
  const dropFlavor = getFlavors(target)

  return isAnyFlavor(dropFlavor[0])
    ? flavors
    : flavors.filter(f => dropFlavor.indexOf(f) !== -1)
}

function getPlaceholder (content) {
  return getNode(`<div class='dnd-placeholder'>${content}</div>`)
}

function getPlaceholderContent (dragSource, options) {
  const dndPlaceholder = dragSource.getAttribute('data-dnd-placeholder')

  if (dndPlaceholder) {
    if (dndPlaceholder === 'clone') {
      return dragSource.outerHTML
    } else if (dndPlaceholder.indexOf('function:') === 0) {
      const placeholderFunction = options[dndPlaceholder.split(':')[1]]
      if (placeholderFunction) { return placeholderFunction }
    } else {
      const placeholderElement = document.querySelector(dndPlaceholder)
      if (placeholderElement) { return placeholderElement.outerHTML }
    }
  }
  return ''
}

function hasTransferableImage (source) {
  return source.hasAttribute('data-image-source') ||
         source.hasAttribute('data-image')
}

function getDraggedElement (source, container) {
  const keepSource = source.getAttribute('data-keep')
  const transferableImageSource = source.hasAttribute('data-image-source')
    ? container.querySelector(source.getAttribute('data-image-source'))
    : null
  const transferableImage = (source.hasAttribute('data-image'))
    ? getNode(source.getAttribute('data-image'))
    : null
  const dragged = transferableImage || (transferableImageSource
    ? cloneNode(transferableImageSource)
    : (keepSource ? cloneNode(source) : source)
  )

  if (!transferableImage && !transferableImageSource) {
    dragged.style.width = source.clientWidth + 'px'
    dragged.style.height = source.clientHeight + 'px'
  }

  dragged.style.position = 'absolute'
  dragged.classList.add('dragged')

  return dragged
}

function legitChildrenFilter (o) {
  const classes = ['.dnd-placeholder'].concat(o.excludedChildrenClasses || [])
  const sel = classes.map(c => `:not(${c})`).join('')

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
