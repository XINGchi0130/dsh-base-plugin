// ══ styles ══ 全部 CSS（CSS 数组）与样式表注入 injectStyles()。改样式只动这个文件。
    // ── 样式 ──────────────────────────────────────────────────────────────

    var CSS = [
      '.dhb-page{display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-title{margin:0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-desc{margin:0;font-size:12px;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dhb-input{flex:1;min-width:160px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-size:13px;outline:none}',
      '.dhb-input:focus{border-color:var(--dsw-alias-label-caption,#aab2bf)}',
      '.dhb-btn{padding:5px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;font-size:12px;line-height:1.4}',
      '.dhb-btn:hover:not(:disabled){border-color:var(--dsw-alias-label-caption,#aab2bf)}',
      '.dhb-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.dhb-btnPrimary{border-color:transparent;background:#2f6fed;color:#fff}',
      '.dhb-btnPrimary:hover:not(:disabled){background:#2459c4;border-color:transparent}',
      '.dhb-btnDanger{color:#c0392b;border-color:#e5c4c0}',
      '.dhb-btnDanger:hover:not(:disabled){border-color:#c0392b}',
      '.dhb-card{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px;background:var(--dsw-alias-bg-base,#fff)}',
      '.dhb-cardTitle{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#222);display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dhb-cardMeta{font-size:12px;color:var(--dsw-alias-label-caption,#8a919e);display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '.dhb-cardDesc{font-size:12px;color:var(--dsw-alias-label-secondary,#3f4550);word-break:break-word}',
      '.dhb-cardActions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.dhb-qrBox{display:flex;justify-content:center;padding:10px;border-radius:10px;background:#fff;width:fit-content;margin:0 auto}',
      '.dhb-qrBox svg{display:block}',
      '.dhb-badge{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;font-size:11px;line-height:1.6;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);color:var(--dsw-alias-label-caption,#8a919e);background:transparent;white-space:nowrap}',
      '.dhb-badge[data-phase="active"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-badge[data-phase="loading"],.dhb-badge[data-phase="pending"]{color:#8a6d1a;border-color:#eadfa8;background:rgba(138,109,26,.07)}',
      '.dhb-badge[data-phase="failed"]{color:#c0392b;border-color:#e5c4c0;background:rgba(192,57,43,.07)}',
      '.dhb-badge[data-kind="ok"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-badge[data-kind="installed"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-badge[data-kind="managed"]{color:#2f6fed;border-color:#c4d6f7;background:rgba(47,111,237,.07)}',
      '.dhb-banner{padding:8px 12px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-word;border:1px solid}',
      '.dhb-banner[data-kind="ok"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-banner[data-kind="err"]{color:#c0392b;border-color:#e5c4c0;background:rgba(192,57,43,.07)}',
      '.dhb-banner[data-kind="warn"]{color:#8a6d1a;border-color:#eadfa8;background:rgba(138,109,26,.07)}',
      '.dhb-list{display:flex;flex-direction:column;gap:8px}',
      '.dhb-form{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px dashed var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px}',
      '.dhb-formTitle{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-field{display:flex;flex-direction:column;gap:3px}',
      '.dhb-label{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-hint{font-size:11px;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-textarea:disabled{opacity:.55;cursor:not-allowed}',
      '.dhb-input:disabled{opacity:.55;cursor:not-allowed}',
      '.dhb-textarea{padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:56px;resize:vertical;outline:none}',
      '.dhb-link{color:#2f6fed;text-decoration:none;font-size:12px}',
      '.dhb-link:hover{text-decoration:underline}',
      '.dhb-skillRow{display:flex;flex-direction:column;gap:2px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px;background:var(--dsw-alias-bg-base,#fff);cursor:pointer;text-align:left;width:100%}',
      '.dhb-skillRow:hover{border-color:var(--dsw-alias-label-caption,#aab2bf)}',
      '.dhb-skillName{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-pre{margin:0;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);background:var(--dsw-alias-markdown-code-block,rgba(127,127,127,.08));font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:420px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-sectTitle{margin:4px 0 0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,#3f4550)}',
      /* 悬停行完全容纳在自身盒内：不用负外边距（官方触发器上方 -4px 的
         渗出让两个命中区重叠，合成器重绘重叠带在浅色主题下表现为灰色
         闪烁）。本行严格限制在自己的盒内。 */
      /* 与侧栏背景同色的不透明垫层：只要底部任意悬停状态变化，祖先滚动
         容器就重绘其底缘（harness 布局行为——分层/隔离都拦不住）。不透明
         垫层让该重绘逐像素一致，于是不可见：「闪烁的线」本是滚动容器圆角
         裁剪边在透明间隙上于两个子像素位置间来回；在实色垫层上两个位置
         画同一颜色。 */
      '.dhb-svcWrap{flex:none;display:flex;width:100%;margin:4px 0;box-sizing:border-box;padding:2px 4px;border-radius:10px;background:var(--dsw-alias-bg-base,#fff)}',
      /* 静态几何不透明垫层：上探越过滚动容器的底部裁剪边、下盖过设置行。
         footerActions 是 position:static，因此这个绝对定位子元素锚到最近
         的定位祖先——侧栏列——恰好就是我们要覆盖的条带。 */
      '.dhb-svcBackdrop{position:absolute;left:0;right:0;top:-10px;bottom:-92px;pointer-events:none;z-index:-1;background:var(--dsw-alias-bg-base,#fff)}',
      /* 悬停不做过渡动画：侧栏底部 flex 行的背景动画在指针进入时明显闪烁
         （过渡头几帧的绘制与 flex 重排竞速）。现在悬停是即时状态切换，
         与下方设置触发器一致。 */
      /* 整数像素几何、不裁剪溢出（圆角悬停自绘遮罩；overflow:hidden 会
         强制裁剪层，其 1px 边缘落在子像素边界上，Retina 屏上闪烁）。 */
      '.dhb-svcBtn{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:6px 10px;box-sizing:border-box;border:none;border-radius:0;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;font-family:inherit;font-size:13px;line-height:22px;white-space:nowrap}',
      '.dhb-svcBtn:first-child{border-radius:12px 0 0 12px}',
      '.dhb-svcBtn:last-child{border-radius:0 12px 12px 0}',
      '.dhb-svcBtn:only-child{border-radius:12px}',
      /* 悬停背景用内嵌 box-shadow 而非 background+圆角：圆角背景强制抗锯齿
         裁剪，上下边在每次合成器提升时重采样（Retina 上的「两条闪烁线」）。
         同半径的内嵌阴影画出完全相同的药丸形，且完全没有裁剪层。 */
      '.dhb-svcBtn:hover:not(:disabled){box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-svcBtn:disabled{opacity:.4;cursor:not-allowed}',
      '.dhb-svcBtn svg{flex:none;display:block}',
      '.dhb-svcStop:hover:not(:disabled){box-shadow:inset 0 0 0 9999px rgba(192,57,43,.08);color:#c0392b}',
      '.dhb-svcRailWrap{flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;margin:4px 0}',
      '.dhb-svcRail{width:36px;height:36px;flex:none;display:flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer}',
      '.dhb-svcRail:hover:not(:disabled){box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-svcRail:disabled{opacity:.4;cursor:not-allowed}',
      /* 高于设置模态（其遮罩在 z-index 1000）：确认卡是对破坏性操作的全局
         应答，绝不能被发起它的界面盖住。 */
      '.dhb-cfmOverlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32))}',
      '.dhb-cfmCard{display:flex;flex-direction:column;gap:14px;width:min(360px,calc(100vw - 48px));padding:18px 20px 16px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 16px 40px rgba(0,0,0,.22);font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-cfmText{margin:0;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-cfmRow{display:flex;justify-content:flex-end;gap:8px}',
      /* 钉在会话头底边框上——与视图 tab 同一行（tab 行是头部最后一行，
         文字距边框约 11px）。bottom:2px 让 28px 按钮的垂直中心对齐 tab
         文字行；right:0 贴住头部右内边距，像末位 tab。
         z-index:7 — the SAME layer the harness gives the sticky composer
         seat (input box), and above markdown CodeBlock sticky banners (6).
         The wrap creates the stacking context for its dropdown menu, so a
         lower value here caps the whole subtree: scrolling content at z6/z7
         painted over the button and even the open menu. */
      '.dhb-smWrap{position:absolute;bottom:2px;right:0;z-index:7;flex:none}',
      '.dhb-smBtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer}',
      '.dhb-smBtn:hover{box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-smMenu{position:absolute;top:calc(100% + 4px);right:12px;z-index:60;padding:4px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 8px 24px rgba(0,0,0,.14);font-size:13px;white-space:nowrap}',
      '.dhb-smItem{display:flex;align-items:center;gap:8px;width:100%;padding:6px 14px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;text-align:left;font-family:inherit;font-size:12.5px}',
      '.dhb-smItem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-gtPage{display:flex;flex-direction:column;gap:10px;height:100%;padding:16px 20px;box-sizing:border-box;font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550);overflow-y:auto}',
      '.dhb-gtHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:none}',
      '.dhb-gtSubTitle{margin:14px 0 6px;font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-gtMeta{font-size:12px;color:var(--dsw-alias-label-caption,#8a919e);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dhb-gtRow{display:flex;flex-direction:column;gap:4px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}',
      '.dhb-gtFileBtn{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:transparent;cursor:pointer;text-align:left;font-size:12px;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-gtFileBtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08))}',
      '.dhb-gtPath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;direction:ltr}',
      '.dhb-gtFrom{font-size:11px;color:var(--dsw-alias-label-caption,#8a919e);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dhb-gtKind{flex:none;display:inline-flex;padding:1px 8px;border-radius:999px;font-size:11px;line-height:1.6;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-gtKind[data-kind="new"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-gtKind[data-kind="modified"]{color:#8a6d1a;border-color:#eadfa8;background:rgba(138,109,26,.07)}',
      '.dhb-gtKind[data-kind="deleted"]{color:#c0392b;border-color:#e5c4c0;background:rgba(192,57,43,.07)}',
      '.dhb-gtKind[data-kind="renamed"]{color:#2f6fed;border-color:#c4d6f7;background:rgba(47,111,237,.07)}',
      '.dhb-gtCounts{flex:none;display:inline-flex;gap:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}',
      '.dhb-gtTime{flex:none;font-size:11px;color:var(--dsw-alias-label-caption,#8a919e);font-variant-numeric:tabular-nums}',
      '.dhb-gtAdd{color:#1e7e34}',
      '.dhb-gtDel{color:#c0392b}',
      '.dhb-diff{margin:0;padding:8px 0;border-top:1px dashed var(--dsw-alias-border-l2,#e3e6ec);background:var(--dsw-alias-markdown-code-block,rgba(127,127,127,.05));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.55;overflow-x:auto;direction:ltr}',
      '.dhb-diffL{display:block;padding:0 12px;white-space:pre;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-diffL[data-k="+"]{color:#1e7e34;background:rgba(30,126,52,.07)}',
      '.dhb-diffL[data-k="-"]{color:#c0392b;background:rgba(192,57,43,.06)}',
      '.dhb-diffL[data-k="@"]{color:#2f6fed}',
      '.dhb-diffL[data-k="h"]{color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-diffN{display:inline-block;text-align:right;padding-right:8px;color:var(--dsw-alias-label-caption,#8a919e);opacity:.75;user-select:none;-webkit-user-select:none;vertical-align:baseline}',
      /* ── Think 折叠展开区高度上限 ─────────────────────────────────────────
         harness 的 ReasoningRow 把整段推理渲染进 .thinkBody，无高度限制，
         展开长推理会把会话流撑开数屏。此处用稳定结构锚点覆盖（类名是
         CSS-module 哈希，不可用；data-variant="think" 是 ReasoningRow 的
         稳定输出）：上限 40vh、内部滚动，展开仍可读完全文。 */
      '[data-variant="think"] [class*="thinkBody"]{max-height:40vh;overflow-y:auto;overscroll-behavior:contain}',
      /* ── 会话消息刻度轨道 ────────────────────────────────────────────────
         注意：此处不做自定义滚动条皮肤——harness 自带 token 驱动的皮肤
         （ui-theme styles/scrollbar.css，暗色自适应，--dsh-scrollbar-width:
         8px）。本插件只在其旁侧加刻度轨道。 */
      /* 消息刻度轨道：固定在原生滚动条旁侧（非覆盖）。容器穿透指针事件、
         只有刻度本身接收——条带不会挡住右缘的文本选择。刻意不画轨道、
         不画视口胶囊：旁边原生滚动条已表达位置，再画一个胶囊会被看成
         第二根滚动条。只有小刻度悬浮于此。 */
      '.dhb-rail{position:fixed;width:12px;z-index:500;pointer-events:none;display:none}',
      '.dhb-rail[data-on="1"]{display:block}',
      /* ⋯ 下拉菜单（任意 dhb-smMenu）打开期间轨道让位——菜单在更低的
         层叠上下文里，会被轨道盖住。 */
      '.dhb-rail[data-menu-open="1"]{display:none}',
      '.dhb-railTick{position:absolute;left:2px;right:2px;height:4px;border-radius:2px;cursor:pointer;pointer-events:auto;transition:transform .12s ease,box-shadow .12s ease}',
      '.dhb-railTick[data-role="user"]{background:rgba(47,111,237,.75)}',
      '.dhb-railTick[data-role="assistant"]{background:rgba(30,126,52,.75)}',
      '.dhb-railTick:hover,.dhb-railTick[data-active="1"]{transform:scaleX(1.6);box-shadow:0 0 0 1px rgba(127,127,127,.35)}',
      '.dhb-railTick[data-role="user"]:hover,.dhb-railTick[data-role="user"][data-active="1"]{background:#2f6fed}',
      '.dhb-railTick[data-role="assistant"]:hover,.dhb-railTick[data-role="assistant"][data-active="1"]{background:#1e7e34}',
      '.dhb-railTip{position:fixed;z-index:510;max-width:280px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 6px 18px rgba(0,0,0,.16);font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,#3f4550);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}',
      '.dhb-tmPage{display:flex;flex-direction:column;height:100%;padding:12px 16px;box-sizing:border-box;gap:8px;font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-tmBar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:none}',
      '.dhb-tmTab{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:none;border-radius:9px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer;font-size:12px;font-family:inherit}',
      '.dhb-tmTab[data-active="1"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-tmTab[data-closing="1"]{opacity:.55;pointer-events:none}',
      '.dhb-tmSpin{display:inline-flex;flex:none;width:13px;height:13px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,#e3e6ec);border-top-color:#2f6fed;animation:dhbSpin .9s linear infinite}',
      '.dhb-tmTab:hover:not([data-active="1"]){color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-tmX{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:none;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font-size:11px;line-height:1;padding:0}',
      '.dhb-tmX:hover{background:rgba(192,57,43,.12);color:#c0392b}',
      '.dhb-tmNew{display:inline-flex;align-items:center;padding:4px 10px;border:none;border-radius:9px;background:transparent;color:#2f6fed;cursor:pointer;font-size:12px;font-family:inherit}',
      '.dhb-tmNew:hover{background:rgba(47,111,237,.08)}',
      '.dhb-tmOut{flex:1;min-height:0;margin:0;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);background:var(--dsw-alias-markdown-code-block,rgba(127,127,127,.06));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;overflow-y:auto;direction:ltr}',
      '.dhb-tmInRow{display:flex;gap:8px;flex:none;align-items:center}',
      '.dhb-tmPrompt{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#1e7e34}',
      '.dhb-tmIn{flex:1;padding:7px 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;outline:none}',
      '.dhb-tmIn:focus{border-color:var(--dsw-alias-label-caption,#aab2bf)}',
      '.dhb-tmCtrl{flex:none;padding:5px 10px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer;font-size:12px;font-family:inherit}',
      '.dhb-tmCtrl:hover{color:#c0392b}',
      '.dhb-usStat{display:flex;flex-direction:column;gap:2px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px;background:var(--dsw-alias-bg-base,#fff);min-width:110px;flex:1}',
      '.dhb-usStatV{font-size:17px;font-weight:600;color:var(--dsw-alias-label-primary,#222);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dhb-usStatL{font-size:11px;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-usTable{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}',
      '.dhb-usTable th{text-align:left;font-weight:500;color:var(--dsw-alias-label-caption,#8a919e);padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);white-space:nowrap}',
      '.dhb-usTable td{padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);white-space:nowrap}',
      '.dhb-usTable td.dhb-usNum{text-align:right}',
      '.dhb-usBars{display:flex;align-items:flex-end;gap:3px;height:64px;padding:8px 0 2px}',
      '.dhb-usBar{flex:1;min-width:4px;background:#2f6fed;opacity:.75;border-radius:2px 2px 0 0}',
      '.dhb-usBar:hover{opacity:1}',
      '.dhb-usPriceRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:8px;border:1px dashed var(--dsw-alias-border-l2,#e3e6ec);border-radius:8px;margin-top:6px}',
      '.dhb-usTabs{display:inline-flex;gap:4px;padding:3px;border-radius:10px;background:var(--dsw-alias-markdown-code-block,rgba(127,127,127,.08))}',
      '.dhb-usTab{padding:4px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer;font-size:12px;font-family:inherit}',
      '.dhb-usTab[data-on="1"]{background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);box-shadow:0 1px 3px rgba(0,0,0,.1)}',
      '.dhb-usChart{display:flex;align-items:flex-end;gap:2px;height:120px;padding:6px 0 0;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);position:relative}',
      '.dhb-usCol{flex:1;min-width:3px;display:flex;flex-direction:column;justify-content:flex-end;border-radius:2px 2px 0 0;overflow:hidden}',
      '.dhb-usCol:hover{filter:brightness(1.15)}',
      '.dhb-usSeg{min-height:1px}',
      '.dhb-usAxis{display:flex;justify-content:space-between;padding:3px 2px 0;font-size:10px;color:var(--dsw-alias-label-caption,#8a919e);font-variant-numeric:tabular-nums}',
      '.dhb-usMaxTag{position:absolute;top:0;left:2px;font-size:10px;color:var(--dsw-alias-label-caption,#8a919e);font-variant-numeric:tabular-nums}',
      '.dhb-usLegend{display:flex;gap:12px;flex-wrap:wrap;padding:4px 2px;font-size:11px;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-usDot{display:inline-block;width:8px;height:8px;border-radius:3px;margin-right:4px;vertical-align:middle}',
      '.dhb-usRange{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.dhb-usDate{padding:4px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-size:12px;font-family:inherit}',
      '.dhb-usPriceIn{width:90px;padding:4px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-size:12px}',
      '.dhb-svcOverlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.32);backdrop-filter:blur(1px)}',
      '.dhb-toolsDock{position:fixed;top:0;right:0;bottom:0;z-index:1500;display:flex;max-width:calc(100vw - 56px);background:var(--dsw-alias-bg-base,#fff);border-left:1px solid var(--dsw-alias-border-l2,#e3e6ec);box-shadow:-6px 0 18px rgba(0,0,0,.10)}',
      '.dhb-toolsResize{flex:none;width:5px;cursor:col-resize;background:transparent;transition:background .15s}',
      '.dhb-toolsResize:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}',
      '.dhb-toolsCrumb{flex:1;min-width:0;display:flex;align-items:center;gap:5px;overflow:hidden;font-size:12px;line-height:1.4}',
      '.dhb-toolsCrumbSess{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-caption,#8a919e);direction:rtl;text-align:left}',
      '.dhb-toolsNav{flex:none;display:flex;align-items:center;gap:6px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);overflow-x:auto;scrollbar-width:thin}',
      '.dhb-toolsNavItem{display:inline-flex;align-items:center;gap:7px;flex:none;padding:6px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;font-size:12.5px;font-family:inherit;line-height:1.4;white-space:nowrap}',
      '.dhb-toolsNavItem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-toolsNavItem[data-active="1"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#222);font-weight:600}',
      '.dhb-toolsMain{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.dhb-toolsHead{flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec)}',
      '.dhb-toolsBody{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch}',
      '.dhb-svcCard{display:flex;flex-direction:column;gap:8px;align-items:center;padding:22px 30px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 16px 40px rgba(0,0,0,.22);font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550);max-width:420px;text-align:center}',
      '.dhb-svcSpin{width:22px;height:22px;border-radius:50%;border:2.5px solid var(--dsw-alias-border-l2,#e3e6ec);border-top-color:#2f6fed;animation:dhbSpin 0.9s linear infinite}',
      '@keyframes dhbSpin{to{transform:rotate(360deg)}}',
      '@keyframes dhbSubPulse{0%,100%{opacity:1}50%{opacity:.35}}',
      /* ── Mobile adaptation (phones reach these pages through the mobile
         proxy; the DSH shell itself auto-collapses below 1024px, these
         rules adapt THIS plugin's own surfaces). Touch-friendly targets,
         scrollable wide tables, full-width tool dock, scaled QR. ──────── */
      '@media (max-width: 760px){',
      /* 触控目标：按钮变大，小图标按钮达到 32px。 */
      '.dhb-btn{padding:8px 14px;font-size:13px}',
      '.dhb-smBtn{width:32px;height:32px}',
      /* 消息刻度轨道是指针精度交互：12px 的小刻度贴着本就由手指拖拽
         控制的滚动条。触屏/窄视口下它们只会截走右缘触摸、徒增噪音——
         整体隐藏（CSS 关断；观察者机制因无元素显示而保持休眠、开销
         极低）。 */
      '.dhb-rail{display:none !important}',
      '.dhb-tmX{width:20px;height:20px}',
      '.dhb-skillRow{padding:12px}',
      /* 输入框与标签同行：允许收缩，不在换行 flex 行里强撑 160px 最小宽。 */
      '.dhb-input{min-width:0}',
      '.dhb-textarea{min-height:72px;font-size:13px}',
      /* 宽表格（用量统计、价格编辑器）各自横向滚动——经典 display:block
         技巧。 */
      '.dhb-usTable{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}',
      /* 统计卡与图表放弃最小宽，让每行换行收纳而非溢出。 */
      '.dhb-usStat{min-width:0}',
      '.dhb-usPriceIn{width:74px}',
      /* 代码块与 diff：把更多视口留给内容。 */
      '.dhb-pre{max-height:56vh}',
      '.dhb-diff{font-size:11px}',
      /* 窄视口下 diff 行号槽收紧。 */
      '.dhb-diffL{padding:0 8px}',
      '.dhb-diffN{padding-right:6px}',
      /* 配对二维码卡随视口缩放。 */
      '.dhb-qrBox svg{width:min(240px,68vw);height:auto}',
      /* 工具坞（文件变更/终端）在桌面是侧栏列；手机上变为全宽覆盖层。
         行内宽度来自 JS 拖拽状态——left:0/right:0 无论如何都钉满。拖宽
         条在触屏上无意义：隐藏。 */
      '.dhb-toolsDock{left:0;right:0;width:100vw !important;max-width:100vw;border-left:none}',
      '.dhb-toolsResize{display:none}',
      '.dhb-gtPage{padding:10px 10px}',
      '.dhb-tmOut{font-size:11.5px}',
      /* 服务状态卡片在小屏上留出呼吸空间。 */
      '.dhb-svcCard{max-width:88vw;padding:18px 16px}',
      /* ── Host settings panel (tagged by the DOM patch above; hashed
         module class names can't be targeted). Desktop: 800px modal,
         188px left nav rail. Phone: full-screen sheet with a top
         horizontally-scrolling nav — the rail otherwise eats half the
         viewport. !important overrides the inline/module geometry. ── */
      '[data-dhb-settings-panel]{width:100vw !important;max-width:100vw !important;height:100vh !important;height:100dvh !important;border-radius:0 !important;flex-direction:column !important}',
      '[data-dhb-settings-nav]{width:100% !important;flex:none !important;flex-direction:row !important;align-items:center;gap:2px !important;padding:6px 8px 0 !important;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l1,#e3e6ec)}',
      /* Title row ("设置") collapses to zero — the header already names the
         active section; keeps the strip a single control row. */
      '[data-dhb-settings-nav] > div:first-child{display:none !important}',
      '[data-dhb-settings-nav] > div:last-child{flex-direction:row !important;gap:2px !important;overflow-x:auto;min-width:0;flex:1;-webkit-overflow-scrolling:touch}',
      '[data-dhb-settings-nav] button{flex:none !important;height:38px !important;padding:7px 12px !important;white-space:nowrap}',
      /* THE critical fix: in the desktop row layout .content was never
         height-flexed so min-width:0 sufficed; flipped to a column its
         main axis is height and min-height:auto floors it at full content
         height — the options area then overflows the panel (clipped by
         overflow:hidden) while scrollHeight==clientHeight, so nothing
         scrolls. min-height:0 lets flex actually shrink it. */
      '[data-dhb-settings-content]{min-height:0 !important}',
      '[data-dhb-settings-options]{padding:14px 12px !important}',
      '}',
    ]

    /** 样式表只插入一次；返回 disposer，停止时移除。 */
    function injectStyles() {
      if (typeof document === 'undefined') return undefined
      if (document.getElementById('dsh-base-plugin/styles') !== null) return undefined
      var tag = document.createElement('style')
      tag.id = 'dsh-base-plugin/styles'
      tag.textContent = CSS.join('\n')
      document.head.appendChild(tag)
      return function () {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
      }
    }
