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
