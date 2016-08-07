import widgets from 'widjet'
import {asArray, cloneNode, getNode, nodeIndex, detachNode} from 'widjet-utils'
import {CompositeDisposable, DisposableEvent} from 'widjet-disposables'

widgets.define('drag-source', (el, options = {}) => {
  const targetContainer = options.targetContainer
    ? options.targetContainer
    : document

  const draggedContainer = options.draggedContainer
    ? options.draggedContainer
    : document

  const transferableImageSourceQuery = el.getAttribute('data-image-source')
  const transferableImageSource = transferableImageSourceQuery
    ? draggedContainer.querySelector(transferableImageSourceQuery)
    : null

  const transferableImage = (el.hasAttribute('data-image'))
    ? getNode(el.getAttribute('data-image'))
    : null

  const keepSource = el.getAttribute('data-keep')
  const noDragOffset = el.hasAttribute('data-no-drag-offset')
  const flavors = (el.getAttribute('data-flavors') || '{all}').split(',')
  const transferable = el.getAttribute('data-transferable').toString()
  const gripSelector = el.getAttribute('data-grip')
  const grip = gripSelector ? el.querySelector(gripSelector) : el
  const excludedChildrenClasses = ['.dnd-placeholder'].concat(options.excludedChildrenClasses || [])

  let dragOffset = null
  let dragging = false
  let originalPos = null
  let originalParent = null
  let originalIndex = null
  let potentialTargets = null
  let potentialTargetsSubscriptions = null
  let windowSubscriptions = null
  let target = null
  let dragged = null
  let placeholder = null

  const startDrag = (e) => {
    const targetSelector = flavors.some(f => f === '{all}')
      ? '[data-drop]'
      : flavors.map(f => `[data-drop][data-flavors*='${f}']`).join(',')

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

    placeholder = getNode("<div class='dnd-placeholder'></div>")
    potentialTargets = asArray(targetContainer.querySelectorAll(targetSelector))

    potentialTargetsSubscriptions = new CompositeDisposable()

    potentialTargets.forEach((potentialTarget) => {
      potentialTarget.classList.add('accept-drop')

      potentialTargetsSubscriptions.add(new DisposableEvent(potentialTarget, 'mouseover', (e) => {
        potentialTarget.classList.add('drop')
        potentialTarget.appendChild(placeholder)

        const potentialTargetSubscription = new CompositeDisposable()

        potentialTargetSubscription.add(new DisposableEvent(potentialTarget, 'mousemove', (e) => {
          let {pageY} = e

          pageY -= targetContainer.defaultView.scrollY

          target = potentialTarget

          const children = ([]).filter.call(potentialTarget.children, (child) => {
            return child.matches(excludedChildrenClasses.map((c) => `:not(${c})`).join(''))
          })

          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            const nextChild = children[i + 1]

            const {top: childTop, height: childHeight} = child.getBoundingClientRect()
            const childHalfHeight = childTop + (childHeight / 2)

            if (pageY < childHalfHeight) {
              potentialTarget.insertBefore(placeholder, child)
              break
            } else if (nextChild) {
              const {top: nextChildTop, height: nextChildHeight} = nextChild.getBoundingClientRect()
              const nextChildHalfHeight = nextChildTop + (nextChildHeight / 2)

              if (pageY >= childHalfHeight && pageY <= nextChildHalfHeight) {
                potentialTarget.insertBefore(placeholder, nextChild)
                break
              }
            } else if (!nextChild && pageY >= childHalfHeight) {
              potentialTarget.appendChild(placeholder)
            }
          }
        }))

        potentialTargetSubscription.add(new DisposableEvent(potentialTarget, 'mouseout', (e) => {
          detachNode(placeholder)
          potentialTarget.classList.remove('drop')
          potentialTargetSubscription.dispose()
          target = null
        }))
      }))
    })
  }

  const stopDrag = (e) => {
    draggedContainer.body.classList.remove('dragging')

    asArray(potentialTargets).forEach((potentialTarget) => {
      potentialTarget.classList.remove('accept-drop')
    })

    if (target != null) {
      const targetIndex = nodeIndex(placeholder)
      const dropFlavor = (target.getAttribute('data-flavors') || '{all}').split(',')

      const matchedFlavors = dropFlavor[0] === '{all}'
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
        if (transferableImageSource || transferableImage) { detachNode(dragged) }

        const next = originalParent.children[originalIndex]

        originalParent.insertBefore(el, next)

        el.classList.remove('dragged')
        el.setAttribute('style', '')
      }
    }
  }

  const drag = (e) => {
    let x = e.pageX
    let y = e.pageY

    if (!noDragOffset) {
      x += dragOffset.x
      y += dragOffset.y
    }

    dragged.style.left = x + 'px'
    dragged.style.top = y + 'px'
  }

  grip.addEventListener('mousedown', (e) => {
    e.stopImmediatePropagation()
    e.stopPropagation()
    e.preventDefault()

    const start = {x: e.pageX, y: e.pageY}

    windowSubscriptions = new CompositeDisposable()
    windowSubscriptions.add(new DisposableEvent(draggedContainer.defaultView, 'mouseup', (e) => {
      e.stopImmediatePropagation()
      if (dragging) {
        stopDrag(e)
        dragging = false
      }

      windowSubscriptions.dispose()
      potentialTargetsSubscriptions && potentialTargetsSubscriptions.dispose()
    }))

    windowSubscriptions.add(new DisposableEvent(draggedContainer.defaultView, 'mousemove', (e) => {
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
    }))
  })
})

widgets.define('drop-target', (el) => {
  const handlerName = el.getAttribute('data-handle')
  const handler = window[handlerName]

  if (!handler) {
    throw new Error('Cannot create a drop target without a handler function')
  }

  el.dropHandle = (transferable, flavors, index, sourceElement) => {
    handler.call(el, transferable, flavors, index, sourceElement)
  }
})
