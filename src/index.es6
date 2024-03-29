import widgets from 'widjet';
import {asArray, asPair, cloneNode, getNode, nodeIndex, detachNode, parent} from 'widjet-utils';
import {CompositeDisposable, DisposableEvent, Disposable} from 'widjet-disposables';

const PLACEHOLDER_CLASS = 'dnd-placeholder';
const ANY_FLAVOR = '{all}';
const isAnyFlavor = f => f === ANY_FLAVOR;

widgets.define('drop-target', (options) => (el) => {
  let handlerDefined = false;
  asPair({
    ondrop: 'drop',
    onenter: 'enter',
    onleave: 'leave',
  }).forEach(([attr, method]) => {
    if (el.hasAttribute(`data-${attr}`)) {
      const handler = options[el.getAttribute(`data-${attr}`)];

      if (handler) {
        handlerDefined = true;
        el[method] = (...args) => { handler.call(el, ...args); };
      } else {
        throw new Error(`A ${method} handler is defined but can't be found.`);
      }
    }
  });

  if (!handlerDefined) {
    throw new Error('Cannot create a drop target without a proper drop or hover handler function');
  }
});

widgets.define('drag-source', (options) => {
  let dragged;
  let dragging;
  let dragOffset;
  let originalIndex;
  let originalParent;
  let originalPos;
  let placeholder;
  let potentialTargets;
  let potentialTargetsSubscriptions;
  let potentialTargetSubscription;
  let target;
  let windowSubscriptions;

  const dropSelector = options.dropSelector || '[data-drop]';
  const dropContainer = options.dropContainer || document;
  const dragContainer = options.dragContainer || document;
  const dragParent = options.dragParent;
  const dragThreshold = options.dragThreshold || 10;

  const filterChildren = legitChildrenFilter(options);

  return (el) => {
    checkPlaceholder(el, options);

    const flavors = getFlavors(el);
    const targetSelector = flavors.some(isAnyFlavor)
      ? dropSelector
      : flavors.map(f => `${dropSelector}[data-flavors*='${f}']`).join(',');

    const keepSource = el.hasAttribute('data-keep-source');
    const noDragOffset = el.hasAttribute('data-no-drag-offset');
    const gripSelector = el.getAttribute('data-grip');
    const lockX = el.hasAttribute('data-lock-x');
    const lockY = el.hasAttribute('data-lock-y');
    const lockInParent = el.hasAttribute('data-lock-in-parent') &&
                         parent(el, el.getAttribute('data-lock-in-parent'));
    const grip = gripSelector ? el.querySelector(gripSelector) : el;

    const getDragContainer = (el) => {
      return dragParent
        ? parent(el, dragParent)
        : dragContainer.body;
    };

    let currentDragContainer;

    const startDrag = (e) => {
      originalPos = el.getBoundingClientRect();
      originalParent = el.parentNode;
      originalIndex = nodeIndex(el);

      dragged = getDraggedElement(el, dragContainer);
      dragging = true;
      dragOffset = {
        x: originalPos.left - e.pageX,
        y: originalPos.top - e.pageY,
      };

      currentDragContainer = getDragContainer(el);

      if (!keepSource) { detachNode(el); }

      currentDragContainer.appendChild(dragged);
      currentDragContainer.classList.add('dragging');


      potentialTargetsSubscriptions = new CompositeDisposable();
      refreshPotentialTargets();
    };

    const refreshPotentialTargets = () => {
      potentialTargets = asArray(dropContainer.querySelectorAll(targetSelector));
      potentialTargets.forEach(setAsPotentialTarget);
    };

    const endDrag = (e) => {
      currentDragContainer.classList.remove('dragging');
      potentialTargets.forEach(n => n.classList.remove('accept-drop'));

      target != null ? performDrop(target) : abortDrag();
    };

    const performDrop = (target) => {
      const targetIndex = nodeIndex(placeholder);

      if (keepSource || hasTransferableImage(el)) {
        detachNode(dragged);
      } else {
        dragged.classList.remove('dragged');
        dragged.setAttribute('style', '');
      }

      target.classList.remove('drop');
      const matchedFlavors = matchingFlavors(flavors, target);

      target.drop({
        transferable: getTransferable(el, options, matchedFlavors),
        flavors: matchedFlavors,
        fromIndex: originalIndex,
        fromTarget: originalParent.matches(dropSelector) ? originalParent : parent(originalParent, dropSelector),
        toIndex: targetIndex,
        toTarget: target,
        source: el,
      });

      detachNode(placeholder);
      placeholder = null;
      target = null;
    };

    const abortDrag = () => {
      if (keepSource) {
        detachNode(dragged);
      } else if (originalParent) {
        if (hasTransferableImage(el)) { detachNode(dragged); }

        const next = originalParent.children[originalIndex];

        originalParent.insertBefore(el, next);

        el.classList.remove('dragged');
        el.setAttribute('style', '');
      }
    };

    const drag = (e) => {
      let {pageX: x, pageY: y} = e;

      const dragContainerBounds = currentDragContainer.getBoundingClientRect();
      x -= dragContainerBounds.left;
      y -= dragContainerBounds.top;

      if (!noDragOffset) {
        x += dragOffset.x;
        y += dragOffset.y;
      }

      if (!lockX) { dragged.style.left = x + 'px'; }
      if (!lockY) { dragged.style.top = y + 'px'; }

      if (lockInParent) { adjustInParent(dragged, lockInParent); }
    };

    const clearAllSubscriptions = () => {
      windowSubscriptions && windowSubscriptions.dispose();
      potentialTargetsSubscriptions && potentialTargetsSubscriptions.dispose();
      potentialTargetSubscription && potentialTargetSubscription.dispose();

      windowSubscriptions = null;
      potentialTargetsSubscriptions = null;
      potentialTargetSubscription = null;
    };

    return new CompositeDisposable([
      new DisposableEvent(grip, 'mousedown', (e) => {
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();

        const start = {x: e.pageX, y: e.pageY};

        windowSubscriptions = new CompositeDisposable([
          new DisposableEvent(dragContainer.defaultView, 'mouseup', (e) => {
            e.stopImmediatePropagation();
            if (dragging) {
              endDrag(e);
              dragging = false;
            }

            clearAllSubscriptions();
          }),
          new DisposableEvent(dragContainer.defaultView, 'mousemove', (e) => {
            e.stopImmediatePropagation();
            if (!dragging) {
              let difX = e.pageX - start.x;
              let difY = e.pageY - start.y;

              if (Math.abs(Math.sqrt((difX * difX) + (difY * difY))) > dragThreshold) {
                startDrag(e);
                drag(e);
              }
            } else {
              drag(e);
            }
          }),
        ]);
      }),
      new Disposable(() => {
        abortDrag();
        clearAllSubscriptions();
      }),
    ]);

    function setAsPotentialTarget(potentialTarget) {
      potentialTarget.classList.add('accept-drop');
      const potentialTargetDropNode = getPotentialTargetDropNode(potentialTarget);

      potentialTargetsSubscriptions.add(new DisposableEvent(potentialTargetDropNode, 'mouseover', (e) => {
        if (potentialTarget.leave) {
          potentialTargetsSubscriptions.add(new DisposableEvent(potentialTargetDropNode, 'mouseout', (e) => {
            potentialTarget.leave(el, potentialTarget, refreshPotentialTargets, e);
          }));
        }

        if (potentialTarget.enter) {
          potentialTarget.enter(el, potentialTarget, refreshPotentialTargets, e);
        } else {
          placeholder = getPlaceholder(el, potentialTarget, options);

          potentialTarget.classList.add('drop');
          potentialTargetDropNode.appendChild(placeholder);

          const findPosition = positionFinder({
            placeholder,
            horizontalDrag: potentialTarget.hasAttribute('data-horizontal-drag'),
            target: potentialTargetDropNode,
          });

          potentialTargetSubscription = new CompositeDisposable([
            new DisposableEvent(potentialTargetDropNode, 'mousemove', (e) => {
              let {pageY: y, pageX: x} = e;

              y -= dropContainer.defaultView.scrollY;
              x -= dropContainer.defaultView.scrollX;
              target = potentialTarget;

              filterChildren(potentialTargetDropNode.children).some(findPosition(x, y));
            }),

            new DisposableEvent(potentialTargetDropNode, 'mouseout', (e) => {
              detachNode(placeholder);
              potentialTarget.classList.remove('drop');
              potentialTargetSubscription.dispose();
              target = null;
              placeholder = null;
              potentialTargetSubscription = null;
            }),
          ]);
        }

      }));
    }

  };
});

function getTransferable(source, options, flavors) {
  const transferableSource = options.transferableSource || 'data-transferable';
  const transferable = source.getAttribute(transferableSource);
  const transferableFunction = options[transferable];
  return typeof transferableFunction === 'function'
    ? transferableFunction(source, flavors)
    : transferable;
}

function getFlavors(source) {
  return (source.getAttribute('data-flavors') || ANY_FLAVOR).split(',');
}

function matchingFlavors(flavors, target) {
  const dropFlavor = getFlavors(target);

  return isAnyFlavor(dropFlavor[0])
    ? flavors
    : flavors.filter(f => dropFlavor.indexOf(f) !== -1);
}

function getPlaceholder(el, potentialTarget, options) {
  const flavors = getFlavors(el);
  const placeholderContent = getPlaceholderContent(el, options);
  const content = typeof placeholderContent === 'function'
    ? placeholderContent(el, potentialTarget, matchingFlavors(flavors, potentialTarget))
    : placeholderContent;

  const cls = options.placeholderClass || PLACEHOLDER_CLASS;
  return getNode(`<div class='${cls}'>${content}</div>`);
}

function getPlaceholderContent(dragSource, options) {
  const placeholder = dragSource.getAttribute('data-dnd-placeholder');

  if (placeholder) {
    if (placeholder === 'clone') {
      return cleanDragAttribtues(cloneNode(dragSource)).outerHTML;
    } else {
      return getCustomPlaceholder(placeholder, options);
    }
  }
  return '';
}

function checkPlaceholder(dragSource, options) {
  const placeholder = dragSource.getAttribute('data-dnd-placeholder');
  if (placeholder && placeholder !== 'clone' && !getCustomPlaceholder(placeholder, options)) {
    throw new Error(`Unable to find a placeholder provider using '${placeholder}' in neither the options nor the DOM`);
  }
}

function getCustomPlaceholder(dndPlaceholder, options) {
  return options[dndPlaceholder] ||
  (document.querySelector(dndPlaceholder) && document.querySelector(dndPlaceholder).outerHTML);
}

function getPotentialTargetDropNode(potentialTarget) {
  return potentialTarget.hasAttribute('data-drop-in-child')
    ? potentialTarget.querySelector(potentialTarget.dataset.dropInChild)
    : potentialTarget;
}

function cleanDragAttribtues(node) {
  node.classList.remove('dragged');
  node.classList.remove('drag-source-handled');
  node.style.position = '';
  node.style.top = '';
  node.style.left = '';
  node.style.width = '';
  node.style.height = '';
  return node;
}

function hasTransferableImage(source) {
  return source.hasAttribute('data-image-source') ||
         source.hasAttribute('data-image');
}

function getDraggedElement(source, container) {
  const keepSource = source.hasAttribute('data-keep-source');
  const transferableImageSource = source.hasAttribute('data-image-source')
    ? container.querySelector(source.getAttribute('data-image-source'))
    : null;
  const transferableImage = (source.hasAttribute('data-image'))
    ? getNode(source.getAttribute('data-image'))
    : null;
  const dragged = transferableImage || (transferableImageSource
    ? cloneNode(transferableImageSource)
    : (keepSource ? cloneNode(source) : source)
  );

  if (!transferableImage && !transferableImageSource) {
    dragged.style.width = source.clientWidth + 'px';
    dragged.style.height = source.clientHeight + 'px';
  }

  dragged.style.position = 'absolute';
  dragged.classList.add('dragged');

  return dragged;
}

function legitChildrenFilter(o) {
  const cls = splitClasses(o.placeholderClass || PLACEHOLDER_CLASS);
  const classes = cls.concat(o.excludedChildrenClasses || []);
  const sel = classes.map(c => `:not(${c})`).join('');

  return children => asArray(children).filter(child => child.matches(sel));
}

function splitClasses(cls) {
  return cls.split(/\s+/g).map(s => `.${s}`);
}

function positionFinder({target, horizontalDrag, placeholder}) {
  return function(pageX, pageY) {
    return function(child, i, children) {
      const nextChild = children[i + 1];

      const {
        top: childTop,
        left: childLeft,
        height: childHeight,
        width: childWidth,
      } = child.getBoundingClientRect();

      const childHalfHeight = childTop + (childHeight / 2);
      const childHalfWidth = childLeft + (childWidth / 2);

      const shouldInsertBefore = horizontalDrag
        ? pageX < childHalfWidth
        : pageY < childHalfHeight;

      if (shouldInsertBefore) {
        target.insertBefore(placeholder, child);
        return true;
      } else if (nextChild) {
        const {
          top: nextChildTop,
          left: nextChildLeft,
          height: nextChildHeight,
          width: nextChildWidth,
        } = nextChild.getBoundingClientRect();

        const nextChildHalfHeight = nextChildTop + (nextChildHeight / 2);
        const nextChildHalfWidth = nextChildLeft + (nextChildWidth / 2);

        const shouldInsertBeforeNextChild = horizontalDrag
          ? pageX >= childHalfWidth && pageX <= nextChildHalfWidth
          : pageY >= childHalfHeight && pageY <= nextChildHalfHeight;

        if (shouldInsertBeforeNextChild) {
          target.insertBefore(placeholder, nextChild);
          return true;
        }
      } else {
        target.appendChild(placeholder);
      }
      return null;
    };
  };
}

function adjustInParent(dragged, parent) {
  const parentBounds = parent.getBoundingClientRect();
  const draggedBounds = dragged.getBoundingClientRect();

  if (draggedBounds.top < parentBounds.top) {
    dragged.style.top = `${parentBounds.top}px`;
  }

  if (draggedBounds.left < parentBounds.left) {
    dragged.style.left = `${parentBounds.left}px`;
  }

  if (draggedBounds.right > parentBounds.right) {
    dragged.style.left = `${parentBounds.right - draggedBounds.width}px`;
  }

  if (draggedBounds.bottom > parentBounds.bottom) {
    dragged.style.top = `${parentBounds.bottom - draggedBounds.height}px`;
  }
}
