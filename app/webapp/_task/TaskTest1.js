/*
**  404.html,favicon.icns,index.html;i18n;scripts;views
**  assets/fonts,assets/images,assets/media,assets/styles
**
**
 */


var _ = require('lodash');
var fs = require('fs');
var del = require('del');
var path = require('path');
var ejs = require('gulp-ejs');
var gulpif = require('gulp-if');
var less = require('gulp-less');
var util = require('./lib/util');
var uglify = require('gulp-uglify');
var usemin = require('gulp-usemin2');
var inject = require('gulp-inject');
var bs = require('browser-sync').create();  // 自动刷新浏览器
var lazyImageCSS = require('gulp-lazyimagecss');  // 自动为图片样式添加 宽/高/background-size 属性
var minifyCSS = require('gulp-cssnano');
var imagemin = require('gulp-imagemin');
var pngquant = require('imagemin-pngquant');
var tmtsprite = require('gulp-tmtsprite');   // 雪碧图合并
var ejshelper = require('tmt-ejs-helper');
var postcss = require('gulp-postcss');  // CSS 预处理
var postcssPxtorem = require('postcss-pxtorem'); // 转换 px 为 rem
var postcssAutoprefixer = require('autoprefixer');
var posthtml = require('gulp-posthtml');
var posthtmlPx2rem = require('posthtml-px2rem');
var RevAll = require('gulp-rev-all');   // reversion
var revDel = require('gulp-rev-delete-original');
var sass = require('gulp-sass');
var changed = require('./common/changed')();

var paths = {
    src: {
        dir: './src',
        img: './src/img/**/*.{JPG,jpg,png,gif}',
        slice: './src/slice/**/*.png',
        js: './src/js/**/*.js',
        media: './src/media/**/*',
        less: './src/css/style-*.less',
        sass: './src/css/style-*.scss',
        html: ['./src/html/**/*.html', '!./src/html/_*/**.html'],
        htmlAll: './src/html/**/*',
        php: './src/**/*.php'
    },
    dist: {
        dir: './dist',
        css: './dist/css',
        img: './dist/img',
        html: './dist/html',
        sprite: './dist/sprite'
    }
};

module.exports = function (gulp, config) {
    var webp = require('./common/webp')(config);

    var lazyDir = config.lazyDir || ['../slice'];

    var postcssOption = [];

    if (config.supportREM) {
        postcssOption = [
            postcssAutoprefixer({browsers: ['last 5 versions']}),
            postcssPxtorem({
                root_value: '20', // 基准值 html{ font-zise: 20px; }
                prop_white_list: [], // 对所有 px 值生效
                minPixelValue: 2 // 忽略 1px 值
            })
        ]
    } else {
        postcssOption = [
            postcssAutoprefixer({browsers: ['last 5 versions']})
        ]
    }

    // 自动刷新
    var reloadHandler = function(){
        config.livereload && bs.reload();
    };

    // 清除 dist 目录
    function delDist() {
        return del([paths.dist.dir]);
    }

    //编译 less
    function compileLess() {
        return gulp.src(paths.src.less)
            .pipe(less({relativeUrls: true}))
            .pipe(lazyImageCSS({imagePath: lazyDir}))
            .pipe(tmtsprite({margin: 4}))
            .pipe(gulpif('*.png', gulp.dest(paths.dist.sprite), gulp.dest(paths.dist.css)));
    }

    //编译 sass
    function compileSass() {
        return gulp.src(paths.src.sass)
            .pipe(sass())
            .on('error', sass.logError)
            .pipe(lazyImageCSS({imagePath: lazyDir}))
            .pipe(tmtsprite({margin: 4}))
            .pipe(gulpif('*.png', gulp.dest(paths.dist.sprite), gulp.dest(paths.dist.css)));
    }

    //自动补全
    function compileAutoprefixer() {
        return gulp.src('./dist/css/style-*.css')
            .pipe(postcss(postcssOption))
            .pipe(gulp.dest('./dist/css/'));
    }

    //CSS 压缩
    function miniCSS() {
        return gulp.src('./dist/css/style-*.css')
            .pipe(minifyCSS({
                safe: true,
                reduceTransforms: false,
                advanced: false,
                compatibility: 'ie7',
                keepSpecialComments: 0
            }))
            .pipe(gulp.dest('./dist/css/'));
    }

    //图片压缩
    function imageminImg() {
        return gulp.src(paths.src.img)
            .pipe(imagemin({
                use: [pngquant()]
            }))
            .pipe(gulp.dest(paths.dist.img));
    }

    //复制媒体文件
    function copyMedia() {
        return gulp.src(paths.src.media, {base: paths.src.dir}).pipe(gulp.dest(paths.dist.dir));
    }

    //js inject
    function myInject(){
        return gulp.src('./src/html/index.html')
            .pipe(inject(gulp.src(paths.src.js,{read:false}),{relative:true}))
            .pipe(gulp.dest('./src/html'));
    }

    //雪碧图压缩
    function imageminSprite() {
        return gulp.src('./dist/sprite/**/*')
            .pipe(imagemin({
                use: [pngquant()]
            }))
            .pipe(gulp.dest(paths.dist.sprite));
    }

    //html 编译
    function compileHtml() {
        return gulp.src(paths.src.html)
            .pipe(ejs(ejshelper()))
            .pipe(gulpif(
                config.supportREM,
                posthtml(
                    posthtmlPx2rem({
                        rootValue: 20,
                        minPixelValue: 2
                    })
                ))
            )
            .pipe(usemin({  //JS 合并压缩
                jsmin: uglify()
            }))
            .pipe(gulp.dest(paths.dist.html));
    }

    //webp 编译
    function supportWebp() {
        if (config['supportWebp']) {
            return webp();
        } else {
            return function noWebp(cb) {
                cb();
            }
        }
    }

    //新文件名(md5)
    function reversion(cb) {
        var revAll = new RevAll({
            fileNameManifest: 'manifest.json',
            dontRenameFile: ['.html', '.php','manifest.json']
        });

        if (config['reversion']) {
            return gulp.src(['./dist/**/*'])
                .pipe(revAll.revision())
                .pipe(gulp.dest(paths.dist.dir))
                .pipe(revDel({
                    exclude: /(.html|.htm)$/
                }))
                .pipe(revAll.manifestFile())
                .pipe(gulp.dest(paths.dist.dir))
                .on('end', reloadHandler);
        } else {
            cb();
        }
    }

    //启动 livereload
    function startServer() {
        bs.init({
            server: paths.dist.dir,
            port: config['livereload']['port'] || 8080,
            startPath: config['livereload']['startPath'] || '/html',
            reloadDelay: 0,
            notify: {      //自定制livereload 提醒条
                styles: [
                    "margin: 0",
                    "padding: 5px",
                    "position: fixed",
                    "font-size: 10px",
                    "z-index: 9999",
                    "bottom: 0px",
                    "right: 0px",
                    "border-radius: 0",
                    "border-top-left-radius: 5px",
                    "background-color: rgba(60,197,31,0.5)",
                    "color: white",
                    "text-align: center"
                ]
            }
        });
    }

    var watchHandler = function (type, file) {
        var target = file.match(/^src[\/|\\](.*?)[\/|\\]/)[1];

        switch (target) {
            case 'img':
                if (type === 'removed') {
                    var tmp = file.replace(/src/, 'dist');
                    del([tmp]);
                } else {
                    imageminImg();
                }
                break;

            case 'slice':
                if (type === 'removed') {
                    var tmp = file.replace('src', 'dist');
                    del([tmp]);
                } else {
                    imageminSprite();
                }
                break;

            case 'js':
                del(['./dist/js/*']);
                if (type === 'removed') {
                    var tmp = file.replace('src', 'dist');
                    del([tmp]);
                    myInject();
                } else if (type === 'add') {
                    myInject();
                } else {
                    // copyHandler('js', file);
                    // uglifyJs();
                    compileHtml();
                }

                break;

            case 'media':
                if (type === 'removed') {
                    var tmp = file.replace('src', 'dist');
                    del([tmp]);
                } else {
                    copyMedia();
                }
                break;

            case 'css':

                var ext = path.extname(file);

                if (type === 'removed') {
                    var tmp = file.replace('src', 'dist').replace(ext, '.css');
                    del([tmp]);
                } else {
                    if(ext === '.less'){
                        compileLess();
                    }else{
                        compileSass();
                    }
                    compileAutoprefixer();
                    miniCSS();
                }

                break;

            case 'html':
                if (type === 'removed') {
                    var tmp = file.replace('src', 'dist');
                    del([tmp]).then(function () {
                        util.loadPlugin('build_dev');
                    });
                } else {
                    compileHtml();
                }

                if (type === 'add') {
                    setTimeout(function () {
                        util.loadPlugin('build_dev');
                    }, 500);
                }

                break;
        }

        setTimeout(function () {
            reversion();
        }, 500);

    };

    //监听文件
    function watch(cb) {
        var watcher = gulp.watch([
                paths.src.img,
                paths.src.slice,
                paths.src.js,
                paths.src.media,
                paths.src.less,
                paths.src.sass,
                paths.src.html
            ],
            {ignored: /[\/\\]\./}
        );

        watcher
            .on('change', function (file) {
                util.log(file + ' has been changed');
                watchHandler('changed', file);
            })
            .on('add', function (file) {
                util.log(file + ' has been added');
                watchHandler('add', file);
            })
            .on('unlink', function (file) {
                util.log(file + ' is deleted');
                watchHandler('removed', file);
            });

        cb();
    }

    //加载插件
    function loadPlugin(cb) {
        util.loadPlugin('build_dev');
        cb();
    }

    //注册 build_dist 任务
    gulp.task('test1', gulp.series(
        delDist,
        compileLess,
        compileSass,
        compileAutoprefixer,
        miniCSS,
        myInject,
        gulp.parallel(
            imageminImg,
            imageminSprite,
            copyMedia
            // uglifyJs
        ),
        compileHtml,
        reversion,
        supportWebp(),
        gulp.parallel(
            watch,
            loadPlugin
        ),
        startServer
    ));
};

