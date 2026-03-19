const tinify = require('tinify');
const { spawnSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports = (ctx) => {
  const register = () => {
    ctx.helper.beforeUploadPlugins.register('compress-pro', {
      handle: async function (ctx) {
        const config = ctx.getConfig('picgo-plugin-compress-pro') || ctx.getConfig('transformer.compress-pro') || {};
        const { 
          type = 'local', 
          tinypngKey, 
          threshold = 50, 
          pngquantPath = '', 
          jpegoptimPath = '' 
        } = config;

        const tasks = ctx.output.map(async (item) => {
          const originSizeKB = item.buffer.length / 1024;
          if (originSizeKB < threshold) return item;

          let tmpFile = '';
          try {
            if (type === 'tinypng' && tinypngKey) {
              tinify.key = tinypngKey;
              item.buffer = await tinify.fromBuffer(item.buffer).toBuffer();
            } else {
              const ext = path.extname(item.fileName).toLowerCase();
              if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') return item;

              // 动态选择临时目录
              let safeDir = os.tmpdir();
              if (ext === '.png' && pngquantPath.includes(':')) {
                safeDir = path.dirname(pngquantPath);
              } else if ((ext === '.jpg' || ext === '.jpeg') && jpegoptimPath.includes(':')) {
                safeDir = path.dirname(jpegoptimPath);
              }

              tmpFile = path.join(safeDir, `picgo_tmp_${Date.now()}${ext}`);
              await fs.writeFile(tmpFile, item.buffer);

              let result;
              // 处理路径补全，区分 Windows 和 Linux 系统
              const isWindows = os.platform() === 'win32';
              const pngquantExe = pngquantPath.endsWith(isWindows ? '\\' : '/') ? path.join(pngquantPath, 'pngquant.exe') : pngquantPath;
              const jpegoptimExe = jpegoptimPath.endsWith(isWindows ? '\\' : '/') ? path.join(jpegoptimPath, 'jpegoptim') : jpegoptimPath;

              if (ext === '.png') {
                ctx.log.info(`[Compress Pro] PNG 压缩开始: ${tmpFile}`);
                result = spawnSync(pngquantExe, ['--force', '--ext', '.png', '--speed', '1', tmpFile]);
              } else {
                ctx.log.info(`[Compress Pro] JPG 压缩开始: ${tmpFile}`);
                result = spawnSync(jpegoptimExe, ['--max=80', '--strip-all', tmpFile]);
              }

              if (result.error) {
                throw new Error(`进程启动失败: ${result.error.message}`);
              }

              if (result.status !== 0 && result.status !== 99) {
                throw new Error(`执行失败，错误码: ${result.status}, 信息: ${result.stderr.toString()}`);
              }

              item.buffer = await fs.readFile(tmpFile);
            }
            ctx.log.info(`[Compress Pro] ${item.fileName} 压缩成功`);
          } catch (err) {
            ctx.log.error(`[Compress Pro] ${item.fileName} 失败: ${err.message}`);
            ctx.emit('notification', {
              title: '图片压缩失败',
              body: `${item.fileName} 压缩失败: ${err.message}`,
              isError: true
            });
          } finally {
            if (tmpFile && fs.existsSync(tmpFile)) {
              await fs.remove(tmpFile);
            }
          }
          return item;
        });

        await Promise.all(tasks);
      }
    });
  };

  const config = (ctx) => {
    let userConfig = ctx.getConfig('picgo-plugin-compress-pro') || {};
    return [
      { name: 'type', type: 'list', alias: '压缩方式', choices: ['local', 'tinypng'], default: userConfig.type || 'local' },
      { name: 'tinypngKey', type: 'input', alias: 'TinyPNG Key', default: userConfig.tinypngKey || '', required: userConfig.type === 'tinypng' },
      { name: 'threshold', type: 'input', alias: '阈值(KB)', default: userConfig.threshold || 50 },
      { name: 'pngquantPath', type: 'input', alias: 'pngquant 路径', default: userConfig.pngquantPath || '', placeholder: '例如 D:\\Tools\\pngquant 或 /usr/local/bin/pngquant' },
      { name: 'jpegoptimPath', type: 'input', alias: 'jpegoptim 路径', default: userConfig.jpegoptimPath || '', placeholder: '例如 D:\\Tools\\jpegoptim 或 /usr/local/bin/jpegoptim' }
    ];
  };

  return { register, config };
};