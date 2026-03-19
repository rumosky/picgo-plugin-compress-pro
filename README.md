## 介绍

一款基于PicGo的图片压缩插件，

> 在插件市场里面试了compress1.4和compress-next1.5.2版本，还有tinypng的插件，但是都无法正常使用，不知道为啥，所以才写了这个插件。

## 功能

支持**本地压缩**和**在线压缩**。

本地压缩使用`pngquant`和`jpegoptim`两个库，在线压缩使用tinypng。

支持以下图片格式的压缩：

PNG（使用 pngquant 压缩）
JPG/JPEG（使用 jpegoptim 压缩）
TinyPNG（通过 TinyPNG API 支持 PNG 和 JPG 格式的压缩）

## 使用

1，选择本地模式，请设置`pngquant`和`jpegoptim`的路径。结尾请添加`/`。
2，选择在线模式，请设置tinypng的API Key。

## 感谢

[pngquant](https://pngquant.org/)

[jpegoptim](https://github.com/tjko/jpegoptim)
