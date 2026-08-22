// ══ icons ══ SVG 图标组：PowerIcon/RestartIcon/FileDiffIcon/TerminalIcon + IME 输入判定 isComposing。
    function isComposing(e) {
      var native = e.nativeEvent !== undefined ? e.nativeEvent : e
      return native.isComposing === true || native.keyCode === 229
    }

    /** 线性图标字形，与侧栏 16/18px 描边节奏一致。 */
    function PowerIcon(props) {
      return h('svg', {
        width: props.size, height: props.size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', 'aria-hidden': 'true',
      },
        h('path', { d: 'M12 3v9' }),
        h('path', { d: 'M18.4 6.6a9 9 0 1 1-12.8 0' }))
    }

    function RestartIcon(props) {
      return h('svg', {
        width: props.size, height: props.size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
        h('path', { d: 'M21 3v6h-6' }))
    }

    /** 带增删标记的文件字形（+ 压 −）：变更面板是只读 git diff 视图，
     * 文件体上的是增/删标记——不是「新文件」的加号。 */
    function FileDiffIcon(props) {
      var size = props.size === undefined ? 15 : props.size
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        h('polyline', { points: '14 2 14 8 20 8' }),
        h('line', { x1: 12, y1: 10, x2: 12, y2: 14 }),
        h('line', { x1: 10, y1: 12, x2: 14, y2: 12 }),
        h('line', { x1: 9, y1: 17, x2: 15, y2: 17 }))
    }

    /** 经典终端字形（>_）。 */
    function TerminalIcon(props) {
      var size = props.size === undefined ? 15 : props.size
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('polyline', { points: '4 17 10 11 4 5' }),
        h('line', { x1: 12, y1: 19, x2: 20, y2: 19 }))
    }

    /** 监控面板字形（心电脉冲线）。 */
    function MonitorIcon(props) {
      var size = props.size === undefined ? 15 : props.size
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('polyline', { points: '2 12 6 12 9 4 15 20 18 12 22 12' }))
    }

    /**
     * 画在 footerActions 内部的不透明背垫：绝对定位垫层、固定宽裕的
     * 上探下探（下盖过官方设置行、上盖过滚动容器底缘）。无测量循环
     * ——相对自身容器的纯 CSS 几何。祖先对底部的每次重绘都变成逐像素
     * 一致（子像素边两侧同为实色），闪烁线无从出现。
     */