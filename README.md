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

### Drag Sources

### Drop Targets
