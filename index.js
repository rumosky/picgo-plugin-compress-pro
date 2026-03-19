const tinify = require('tinify');
const { execa } = require('execa');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports = (ctx) => {
  const register = () => {
    // 注册插件钩子：在上传之前处理图片
    ctx.helper.beforeUploadPlugins.register('compress-pro', {
      handle: async function (ctx) {
        const config = ctx.getConfig('transformer.compress-pro') || {};
        const { type = 'local', tinypngKey, threshold = 50, pngquantPath = 'pngquant', jpegoptimPath = 'jpegoptim' } = config;

        // 遍历待上传的图片
        const tasks = ctx.output.map(async (item) => {
          // 1. 阈值检查 (单位：KB)
          const originSizeKB = item.buffer.length / 1024;
          if (originSizeKB < threshold) {
            ctx.log.info(`[Compress Pro] 跳过压缩：${item.fileName} (${originSizeKB.toFixed(2)}KB < ${threshold}KB)`);
            return item;
          }

          try {
            if (type === 'tinypng' && tinypngKey) {
              // --- 远程压缩：TinyPNG ---
              ctx.log.info(`[Compress Pro] 正在使用 TinyPNG 压缩: ${item.fileName}`);
              tinify.key = tinypngKey;
              const compressedBuffer = await tinify.fromBuffer(item.buffer).toBuffer();
              item.buffer = compressedBuffer;
            } else {
              // --- 本地压缩：pngquant / jpegoptim ---
              ctx.log.info(`[Compress Pro] 正在使用本地压缩: ${item.fileName}`);
              const ext = path.extname(item.fileName).toLowerCase();
              const tmpFile = path.join(os.tmpdir(), `picgo-tmp-${Date.now()}${ext}`);
              
              // 先写入临时文件
              await fs.writeFile(tmpFile, item.buffer);

              if (ext === '.png') {
                // pngquant 压缩
                await execa(pngquantPath, ['--force', '--ext', ext, '--quality', '65-80', tmpFile]);
              } else if (ext === '.jpg' || ext === '.jpeg') {
                // jpegoptim 压缩
                await execa(jpegoptimPath, ['--max=80', '--strip-all', tmpFile]);
              }

              // 读取压缩后的文件并回填到 PicGo
              item.buffer = await fs.readFile(tmpFile);
              await fs.remove(tmpFile); // 清理临时文件
            }
            
            const newSizeKB = item.buffer.length / 1024;
            ctx.log.info(`[Compress Pro] 压缩成功: ${item.fileName} (${originSizeKB.toFixed(2)}KB -> ${newSizeKB.toFixed(2)}KB)`);
          } catch (err) {
            ctx.log.error(`[Compress Pro] 压缩失败: ${err.message}`);
          }
          return item;
        });

        await Promise.all(tasks);
      }
    });
  };

  // 配置项定义
  const config = (ctx) => {
    let userConfig = ctx.getConfig('transformer.compress-pro') || {};
    return [
      {
        name: 'type',
        type: 'list',
        alias: '压缩方式',
        choices: ['local', 'tinypng'],
        default: userConfig.type || 'local',
        required: true
      },
      {
        name: 'tinypngKey',
        type: 'input',
        alias: 'TinyPNG API Key',
        default: userConfig.tinypngKey || '',
        message: '仅在使用 tinypng 方式时需要',
        required: false
      },
      {
        name: 'threshold',
        type: 'input',
        alias: '压缩阈值 (KB)',
        default: userConfig.threshold || 50,
        message: '大于此体积的图片才会触发压缩',
        required: false
      },
      {
        name: 'pngquantPath',
        type: 'input',
        alias: 'pngquant 路径',
        default: userConfig.pngquantPath || 'pngquant',
        message: '本地执行文件的路径，若已加入环境变量可直接写文件名',
        required: false
      },
      {
        name: 'jpegoptimPath',
        type: 'input',
        alias: 'jpegoptim 路径',
        default: userConfig.jpegoptimPath || 'jpegoptim',
        message: '本地执行文件的路径',
        required: false
      }
    ];
  };

  return {
    register,
    transformer: 'compress-pro',
    config
  };
};
