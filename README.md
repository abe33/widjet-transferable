# widjet-transferable [![Build Status](https://travis-ci.org/abe33/widjet-transferable.svg?branch=master)](https://travis-ci.org/abe33/widjet-transferable)

A drag and drop widget for [widjet](https://github.com/abe33/widjet)

## Install

```sh
npm install widjet-transferable --save
```

## Usage

```js
import widgets from 'widjet'
import 'widjet-transferable'

widgets('drag-source', '[data-transferable]', {on: 'load'})
widgets('drop-target', '[data-drop]', {on: 'load'})
```

This package provides two widgets, `drag-source` and `drop-target`.

The former is used to define which elements can be dragged into a page and how their drag and drop gesture will be handled.

The latter is used to define the places where dragged elements can be dropped and what to do on drop.

### Drop Targets

The `drop-target` widget only do one thing, and it's to create a `drop` function on the matched element that will be called by the drag and drop handler when a source is dragged onto the target.

The `drop` function will call the method defined in the `data-ondrop` attribute of the drop target. The function must be defined on the `options` object passed to the widget:  

```js
widgets('drop-target', '[data-drop]', {
  on: 'load',
  myCustomDropHandler: (transferable, flavors, index, source) => {
    // ...
  }
})
```

```html
<div data-drop data-ondrop='myCustomDropHandler'></div>
```

Drop targets, or drop zones, are generally identified with the `data-drop` attribute. But this can be changed in the `drag-source` options.

### Drag Sources

The `drag-source` widget offers much more options that the one for drop targets, as it's the one that will really enable the drag-and-drop gesture.

Most of a source configuration is done through attributes, the widget options being reserved to global drag-and-drop configuration, such as changing the drop target selector or the main containers when dealing with drag and drop accross frames.

```js
widgets('darg-source', '[data-transferable]', {on: 'load'})
```

```html
<div data-transferable='data to transfer' data-flavors='{some flavor}'></div>
```

#### Attributes

Attribute|Type|Description
---|---|---
`data-transferable`|`*` or `function:<name>`|<p>It's probably the single most important attribute for a drag-source, it's generally the one you'll want to watch match to determine which elements are draggable and which data they carry.</p><p>If the attribute value is prefixed with `function:` the widget will look for a function with the specified name on the options object. This function will receive the source node and the flavors shared with the drop target and must returns the transferable data.</p><p>In any other case, the transferable data will just be the content of the attribute.</p>
`data-flavors`|`array`|<p>Flavors are strings that defines how a drag source can interact with a drop target.</p><p>Basically, if a source and a target share at least one flavor in common the source is allowed to be dropped onto the target.</p><p>As potential targets for a source are determined using a CSS selector using `[data-flavors*="<flavor>"]`, flavors should be wrapped with some characters to prevent false positive.</p>Example: `data-flavors="{foo},{bar}"`
`data-keep-source`|`boolean`|When this attribute is present, the source element won't be removed from the DOM when the drag gesture is started, if no image attribute is defined, the source will simply be cloned.
`data-image`|`html`|When defined with HTML, the content will be used instead of the source as the image for the drag gesture.
`data-image-source`|`selector`|When defined with a cSS selector, the first element matched by the query will be cloned and used instead of the source as the image for the drag gesture.
`data-dnd-placeholder`|`selector`, `clone` or `function:<name>`|<p>When dragged above a drop target, a placeholder will be added in that target, allowing to present to the user information about the drop, such as the position of the drop if the target already has some children.</p><p>If a CSS selector is provided, the first element to match will be cloned in the placeholder.</p><p>If the value is `clone` the source itself will be cloned and placed in the placeholder.</p><p>Finally, if the value is prefixed with `function:`, the widget will look for a function of the given name on the options object and will call that function with the source, the target and the matching flavors between the two. The function should then returns the HTML content for the placeholder.</p>
`data-no-drag-offset`|`boolean`|<p>When a drag gesture is started, the initial position of the mouse inside the source is preserved and used as an offset during the drag gesture.</p><p>By setting this attribute, the offset will no longer be applied to the dragged element.</p>
