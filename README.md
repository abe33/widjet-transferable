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
`data-transferable`|`*` or `function:<name>`|It's probably the single most important attribute for a drag-source, it's generally the one you'll want to watch match to determine which elements are draggable and which data they carry. If the attribute value is prefixed with `function:` the widget will look for a function with the specified name on the options object. This function will receive the source node and the flavors shared with the drop target and must returns the transferable data. In any other case, the transferable data will just be the content of the attribute.
