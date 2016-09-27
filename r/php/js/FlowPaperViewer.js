var Mouse = {
    x: 0,
    y: 0,
    refresh: function(e) {
        if (e && !this.down && !jQuery(e.target).hasClass("flowpaper_zoomSlider")) {
            return;
        }
        var posx = 0,
            posy = 0;
        if (!e) {
            e = window.event;
        }
        if (e.pageX || e.pageY) {
            posx = e.pageX;
            posy = e.pageY;
        } else {
            if (e.clientX || e.clientY) {
                posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
            }
        }
        this.x = posx;
        this.y = posy;
    }
};
var mouseMoveHandler = document.onmousemove || function() {};
document.onmousemove = function(e) {
    if (!e) {
        e = window.event;
    }
    if (e && e.which == 1) {
        Mouse.down = true;
    }
    Mouse.refresh(e);
};
var MPosition = {
    get: function(obj) {
        var curleft = curtop = 0;
        if (obj.offsetParent) {
            do {
                curleft += obj.offsetLeft;
                curtop += obj.offsetTop;
            } while (obj = obj.offsetParent);
        }
        return [curleft, curtop];
    }
};
var Slider = function(wrapper, options) {
    if (typeof wrapper == "string") {
        wrapper = document.getElementById(wrapper);
    }
    if (!wrapper) {
        return;
    }
    var handle = wrapper.getElementsByTagName("div")[0];
    if (!handle || handle.className.search(/(^|\s)flowpaper_handle(\s|$)/) == -1) {
        return;
    }
    this.init(wrapper, handle, options || {});
    this.setup();
};
Slider.prototype = {
    init: function(wrapper, handle, options) {
        this.wrapper = wrapper;
        this.handle = handle;
        this.options = options;
        this.value = {
            current: options.value || 0,
            target: options.value || 0,
            prev: -1
        };
        this.disabled = options.disabled || false;
        this.steps = options.steps || 0;
        this.snapping = options.snapping || false;
        this.speed = options.speed || 5;
        this.callback = options.callback || null;
        this.animation_callback = options.animation_callback || null;
        this.bounds = {
            pleft: options.pleft || 0,
            left: 0,
            pright: -(options.pright || 0),
            right: 0,
            width: 0,
            diff: 0
        };
        this.offset = {
            wrapper: 0,
            mouse: 0,
            target: 0,
            current: 0,
            prev: -9999
        };
        this.dragging = false;
        this.tapping = false;
    },
    setup: function() {
        var self = this;
        this.wrapper.onselectstart = function() {
            return false;
        };
        this.handle.onmousedown = function(e) {
            self.preventDefaults(e, true);
            this.focus();
            self.handleMouseDownHandler(e);
        };
        this.wrapper.onmousedown = function(e) {
            self.preventDefaults(e);
            self.wrapperMouseDownHandler(e);
        };
        var mouseUpHandler = document.onmouseup || function() {};
        if (document.addEventListener) {
            document.addEventListener("mouseup", function(e) {
                if (self.dragging) {
                    mouseUpHandler(e);
                    self.preventDefaults(e);
                    self.documentMouseUpHandler(e);
                }
            });
        } else {
            document.onmouseup = function(e) {
                if (self.dragging) {
                    mouseUpHandler(e);
                    self.preventDefaults(e);
                    self.documentMouseUpHandler(e);
                }
            };
        }
        var resizeHandler = document.onresize || function() {};
        window.onresize = function(e) {
            resizeHandler(e);
            self.setWrapperOffset();
            self.setBounds();
        };
        this.setWrapperOffset();
        if (!this.bounds.pleft && !this.bounds.pright) {
            this.bounds.pleft = MPosition.get(this.handle)[0] - this.offset.wrapper;
            this.bounds.pright = -this.bounds.pleft;
        }
        this.setBounds();
        this.setSteps();
        this.interval = setInterval(function() {
            self.animate();
        }, 100);
        self.animate(false, true);
    },
    setWrapperOffset: function() {
        this.offset.wrapper = MPosition.get(this.wrapper)[0];
    },
    setBounds: function() {
        this.bounds.left = this.bounds.pleft;
        this.bounds.right = this.bounds.pright + this.wrapper.offsetWidth;
        this.bounds.width = this.bounds.right - this.bounds.left;
        this.bounds.diff = this.bounds.width - this.handle.offsetWidth;
    },
    setSteps: function() {
        if (this.steps > 1) {
            this.stepsRatio = [];
            for (var i = 0; i <= this.steps - 1; i++) {
                this.stepsRatio[i] = i / (this.steps - 1);
            }
        }
    },
    disable: function() {
        this.disabled = true;
        this.handle.className += " disabled";
    },
    enable: function() {
        this.disabled = false;
        this.handle.className = this.handle.className.replace(/\s?disabled/g, "");
    },
    handleMouseDownHandler: function(e) {
        if (Mouse) {
            Mouse.down = true;
            Mouse.refresh(e);
        }
        var self = this;
        this.startDrag(e);
        this.cancelEvent(e);
    },
    wrapperMouseDownHandler: function(e) {
        this.startTap();
    },
    documentMouseUpHandler: function(e) {
        this.stopDrag();
        this.stopTap();
        if (Mouse) {
            Mouse.down = false;
        }
    },
    startTap: function(target) {
        if (this.disabled) {
            return;
        }
        if (target === undefined) {
            target = Mouse.x - this.offset.wrapper - this.handle.offsetWidth / 2;
        }
        this.setOffsetTarget(target);
        this.tapping = true;
    },
    stopTap: function() {
        if (this.disabled || !this.tapping) {
            return;
        }
        this.setOffsetTarget(this.offset.current);
        this.tapping = false;
        this.result();
    },
    startDrag: function(e) {
        if (!e) {
            e = window.event;
        }
        if (this.disabled) {
            return;
        }
        this.offset.mouse = Mouse.x - MPosition.get(this.handle)[0];
        this.dragging = true;
        if (e.preventDefault) {
            e.preventDefault();
        }
    },
    stopDrag: function() {
        if (this.disabled || !this.dragging) {
            return;
        }
        this.dragging = false;
        this.result();
    },
    feedback: function() {
        var value = this.value.current;
        if (this.steps > 1 && this.snapping) {
            value = this.getClosestStep(value);
        }
        if (value != this.value.prev) {
            if (typeof this.animation_callback == "function") {
                this.animation_callback(value);
            }
            this.value.prev = value;
        }
    },
    result: function() {
        var value = this.value.target;
        if (this.steps > 1) {
            value = this.getClosestStep(value);
        }
        if (typeof this.callback == "function") {
            this.callback(value);
        }
    },
    animate: function(onMove, first) {
        if (onMove && !this.dragging) {
            return;
        }
        if (this.dragging) {
            this.setOffsetTarget(Mouse.x - this.offset.mouse - this.offset.wrapper);
        }
        this.value.target = Math.max(this.value.target, 0);
        this.value.target = Math.min(this.value.target, 1);
        this.offset.target = this.getOffsetByRatio(this.value.target);
        if (!this.dragging && !this.tapping || this.snapping) {
            if (this.steps > 1) {
                this.setValueTarget(this.getClosestStep(this.value.target));
            }
        }
        if (this.dragging || first) {
            this.value.current = this.value.target;
        }
        this.slide();
        this.show();
        this.feedback();
    },
    slide: function() {
        if (this.value.target > this.value.current) {
            this.value.current += Math.min(this.value.target - this.value.current, this.speed / 100);
        } else {
            if (this.value.target < this.value.current) {
                this.value.current -= Math.min(this.value.current - this.value.target, this.speed / 100);
            }
        }
        if (!this.snapping) {
            this.offset.current = this.getOffsetByRatio(this.value.current);
        } else {
            this.offset.current = this.getOffsetByRatio(this.getClosestStep(this.value.current));
        }
    },
    show: function() {
        if (this.offset.current != this.offset.prev) {
            this.handle.style.left = String(this.offset.current) + "px";
            this.offset.prev = this.offset.current;
        }
    },
    setValue: function(value, snap) {
        this.setValueTarget(value);
        if (snap) {
            this.value.current = this.value.target;
        }
    },
    setValueTarget: function(value) {
        this.value.target = value;
        this.offset.target = this.getOffsetByRatio(value);
    },
    setOffsetTarget: function(value) {
        this.offset.target = value;
        this.value.target = this.getRatioByOffset(value);
    },
    getRatioByOffset: function(offset) {
        return (offset - this.bounds.left) / this.bounds.diff;
    },
    getOffsetByRatio: function(ratio) {
        return Math.round(ratio * this.bounds.diff) + this.bounds.left;
    },
    getClosestStep: function(value) {
        var k = 0;
        var min = 1;
        for (var i = 0; i <= this.steps - 1; i++) {
            if (Math.abs(this.stepsRatio[i] - value) < min) {
                min = Math.abs(this.stepsRatio[i] - value);
                k = i;
            }
        }
        return this.stepsRatio[k];
    },
    preventDefaults: function(e, selection) {
        if (!e) {
            e = window.event;
        }
        if (e.preventDefault) {
            e.preventDefault();
        }
        if (selection && document.selection) {
            document.selection.empty();
        }
    },
    cancelEvent: function(e) {
        if (!e) {
            e = window.event;
        }
        if (e.stopPropagation) {
            e.stopPropagation();
        } else {
            e.cancelBubble = true;
        }
    }
};
var D, FLOWPAPER = window.FLOWPAPER ? window.FLOWPAPER : window.FLOWPAPER = {};
FLOWPAPER.Gj = function() {
    var f = [];
    return {
        zq: function(c) {
            f.push(c);
        },
        notify: function(c, d) {
            for (var e = 0, g = f.length; e < g; e++) {
                var h = f[e];
                if (h[c]) {
                    h[c](d);
                }
            }
        }
    };
}();

function K(f) {
    FLOWPAPER.Gj.notify("warn", f);
}

function O(f, c, d, e) {
    try {
        throw Error();
    } catch (g) {}
    FLOWPAPER.Gj.notify("error", f);
    d && c && (e ? jQuery("#" + d).trigger(c, e) : jQuery("#" + d).trigger(c));
    throw Error(f);
}
FLOWPAPER.Ek = {
    init: function() {
        "undefined" != typeof eb && eb || (eb = {});
        var f = navigator.userAgent.toLowerCase(),
            c = location.hash.substr(1),
            d = !1,
            e = "";
        0 <= c.indexOf("mobilepreview=") && (d = !0, e = c.substr(c.indexOf("mobilepreview=")).split("&")[0].split("=")[1]);
        var g;
        try {
            g = "ontouchstart" in document.documentElement;
        } catch (u) {
            g = !1;
        }!g && (f.match(/iphone/i) || f.match(/ipod/i) || f.match(/ipad/i)) && (d = !0);
        c = eb;
        g = /win/.test(f);
        var h = /mac/.test(f),
            l;
        if (!(l = d)) {
            try {
                l = "ontouchstart" in document.documentElement;
            } catch (u) {
                l = !1;
            }
        }
        c.platform = {
            win: g,
            mac: h,
            touchdevice: l || f.match(/touch/i) || navigator.Db || navigator.msPointerEnabled,
            ios: d && ("ipad" == e || "iphone" == e) || f.match(/iphone/i) || f.match(/ipod/i) || f.match(/ipad/i),
            android: d && "android" == e || -1 < f.indexOf("android"),
            Kd: d && ("ipad" == e || "iphone" == e) || navigator.userAgent.match(/(iPad|iPhone);.*CPU.*OS 6_\d/i),
            iphone: d && "iphone" == e || f.match(/iphone/i) || f.match(/ipod/i),
            ipad: d && "ipad" == e || f.match(/ipad/i),
            winphone: f.match(/Windows Phone/i) || f.match(/iemobile/i) || f.match(/WPDesktop/i),
            yp: f.match(/Windows NT/i) && f.match(/ARM/i) && f.match(/touch/i),
            Wl: navigator.Db || navigator.msPointerEnabled,
            blackberry: f.match(/BlackBerry/i) || f.match(/BB10/i),
            webos: f.match(/webOS/i),
            Em: -1 < f.indexOf("android") && !(jQuery(window).height() < jQuery(window).width()),
            mobilepreview: d,
            rd: window.devicePixelRatio ? window.devicePixelRatio : 1
        };
        d = eb;
        e = document.createElement("div");
        e.innerHTML = "000102030405060708090a0b0c0d0e0f";
        d.Xd = e;
        eb.platform.touchonlydevice = eb.platform.touchdevice && (eb.platform.android || eb.platform.ios || eb.platform.blackberry || eb.platform.webos) || eb.platform.winphone || eb.platform.yp;
        eb.platform.Ib = eb.platform.touchonlydevice && (eb.platform.iphone || eb.platform.Em || eb.platform.blackberry);
        eb.platform.ios && (d = navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/), null != d && 1 < d.length ? (eb.platform.iosversion = parseInt(d[1], 10), eb.platform.Kd = 6 <= eb.platform.iosversion) : eb.platform.Kd = !0);
        eb.browser = {
            version: (f.match(/.+?(?:rv|it|ra|ie)[\/: ]([\d.]+)(?!.+opera)/) || [])[1],
            Hb: (f.match(/.+?(?:version|chrome|firefox|opera|msie|OPR)[\/: ]([\d.]+)(?!.+opera)/) || [])[1],
            safari: (/webkit/.test(f) || /applewebkit/.test(f)) && !/chrome/.test(f),
            opera: /opera/.test(f),
            msie: /msie/.test(f) && !/opera/.test(f) && !/applewebkit/.test(f),
            Ti: "Netscape" == navigator.appName && null != /Trident\/.*rv:([0-9]{1,}[.0-9]{0,})/.exec(navigator.userAgent) && !/opera/.test(f),
            mozilla: /mozilla/.test(f) && !/(compatible|webkit)/.test(f),
            chrome: /chrome/.test(f),
            Hi: window.innerHeight > window.innerWidth
        };
        eb.browser.detected = eb.browser.safari || eb.browser.opera || eb.browser.msie || eb.browser.mozilla || eb.browser.seamonkey || eb.browser.chrome || eb.browser.Ti;
        eb.browser.detected && eb.browser.version || (eb.browser.chrome = !0, eb.browser.version = "500.00");
        if (eb.browser.msie) {
            var f = eb.browser,
                k;
            try {
                k = !!new ActiveXObject("htmlfile");
            } catch (u) {
                k = !1;
            }
            f.ir = k && "Win64" == navigator.platform && document.documentElement.clientWidth == screen.width;
        }
        eb.browser.version && 1 < eb.browser.version.match(/\./g).length && (eb.browser.version = eb.browser.version.substr(0, eb.browser.version.indexOf(".", eb.browser.version.indexOf("."))));
        eb.browser.Hb && 1 < eb.browser.Hb.match(/\./g).length && (eb.browser.Hb = eb.browser.Hb.substr(0, eb.browser.Hb.indexOf(".", eb.browser.Hb.indexOf("."))));
        k = eb.browser;
        var f = !eb.platform.touchonlydevice || eb.platform.android && !window.annotations || eb.platform.Kd && !window.annotations || eb.platform.ios && 6.99 <= eb.platform.iosversion && !window.annotations,
            d = eb.browser.mozilla && 4 <= eb.browser.version.split(".")[0] || eb.browser.chrome && 535 <= eb.browser.version.split(".")[0] || eb.browser.msie && 10 <= eb.browser.version.split(".")[0] || eb.browser.safari && 534 <= eb.browser.version.split(".")[0],
            e = document.documentElement.requestFullScreen || document.documentElement.mozRequestFullScreen || document.documentElement.webkitRequestFullScreen,
            m;
        try {
            m = !!window.WebGLRenderingContext && !!document.createElement("canvas").getContext("experimental-webgl");
        } catch (u) {
            m = !1;
        }
        k.rb = {
            Bb: f,
            xp: d,
            Pr: e,
            Np: m
        };
        if (eb.browser.msie) {
            m = eb.browser;
            var n;
            try {
                null != /MSIE ([0-9]{1,}[.0-9]{0,})/.exec(navigator.userAgent) && (rv = parseFloat(RegExp.$1)), n = rv;
            } catch (u) {
                n = -1;
            }
            m.version = n;
        }
    }
};

function P() {
    for (var f = eb.Sg.innerHTML, c = [], d = 0;
        "\n" != f.charAt(d) && d < f.length;) {
        for (var e = 0, g = 6; 0 <= g; g--) {
            " " == f.charAt(d) && (e |= Math.pow(2, g)), d++;
        }
        c.push(String.fromCharCode(e));
    }
    return c.join("");
}

function aa(f, c, d) {
    this.aa = f;
    this.Gd = c;
    this.containerId = d;
    this.scroll = function() {
        var c = this;
        jQuery(this.Gd).bind("mousedown", function(d) {
            if (c.aa.Mc || f.gi && f.gi() || jQuery("*:focus").hasClass("flowpaper_textarea_contenteditable") || jQuery("*:focus").hasClass("flowpaper_note_textarea")) {
                return d.returnValue = !1, !0;
            }
            if (c.aa.Fc) {
                return !0;
            }
            c.ap(c.Gd);
            c.oj = d.pageY;
            c.mj = d.pageX;
            return !1;
        });
        jQuery(this.Gd).bind("mousemove", function(d) {
            return c.an(d);
        });
        this.aa.fm || (jQuery(this.containerId).bind("mouseout", function(d) {
            c.Gn(d);
        }), jQuery(this.containerId).bind("mouseup", function() {
            c.Gl();
        }), this.aa.fm = !0);
    };
    this.an = function(c) {
        if (!this.aa.Li) {
            return !0;
        }
        this.aa.gk != this.Gd && (this.oj = c.pageY, this.mj = c.pageX, this.aa.gk = this.Gd);
        this.scrollTo(this.mj - c.pageX, this.oj - c.pageY);
        this.oj = c.pageY;
        this.mj = c.pageX;
        return !1;
    };
    this.ap = function(c) {
        this.aa.Li = !0;
        this.aa.gk = c;
        jQuery(this.Gd).removeClass("flowpaper_grab");
        jQuery(this.Gd).addClass("flowpaper_grabbing");
    };
    this.Gn = function(c) {
        0 == jQuery(this.aa.ia).has(c.target).length && this.Gl();
    };
    this.Gl = function() {
        this.aa.Li = !1;
        jQuery(this.Gd).removeClass("flowpaper_grabbing");
        jQuery(this.Gd).addClass("flowpaper_grab");
    };
    this.scrollTo = function(c, d) {
        var h = jQuery(this.containerId).scrollLeft() + c,
            f = jQuery(this.containerId).scrollTop() + d;
        jQuery(this.containerId).scrollLeft(h);
        jQuery(this.containerId).scrollTop(f);
    };
}

function ba(f) {
    function c(c, d) {
        var e, g, h, f, l;
        h = c & 2147483648;
        f = d & 2147483648;
        e = c & 1073741824;
        g = d & 1073741824;
        l = (c & 1073741823) + (d & 1073741823);
        return e & g ? l ^ 2147483648 ^ h ^ f : e | g ? l & 1073741824 ? l ^ 3221225472 ^ h ^ f : l ^ 1073741824 ^ h ^ f : l ^ h ^ f;
    }

    function d(d, e, g, h, f, l, k) {
        d = c(d, c(c(e & g | ~e & h, f), k));
        return c(d << l | d >>> 32 - l, e);
    }

    function e(d, e, g, h, f, l, k) {
        d = c(d, c(c(e & h | g & ~h, f), k));
        return c(d << l | d >>> 32 - l, e);
    }

    function g(d, e, g, h, f, l, k) {
        d = c(d, c(c(e ^ g ^ h, f), k));
        return c(d << l | d >>> 32 - l, e);
    }

    function h(d, e, g, h, f, l, k) {
        d = c(d, c(c(g ^ (e | ~h), f), k));
        return c(d << l | d >>> 32 - l, e);
    }

    function l(c) {
        var d = "",
            e = "",
            g;
        for (g = 0; 3 >= g; g++) {
            e = c >>> 8 * g & 255, e = "0" + e.toString(16), d += e.substr(e.length - 2, 2);
        }
        return d;
    }
    var k = [],
        m, n, u, v, p, q, r, t;
    f = function(c) {
        c = c.replace(/\r\n/g, "\n");
        for (var d = "", e = 0; e < c.length; e++) {
            var g = c.charCodeAt(e);
            128 > g ? d += String.fromCharCode(g) : (127 < g && 2048 > g ? d += String.fromCharCode(g >> 6 | 192) : (d += String.fromCharCode(g >> 12 | 224), d += String.fromCharCode(g >> 6 & 63 | 128)), d += String.fromCharCode(g & 63 | 128));
        }
        return d;
    }(f);
    k = function(c) {
        var d, e = c.length;
        d = e + 8;
        for (var g = 16 * ((d - d % 64) / 64 + 1), h = Array(g - 1), f = 0, l = 0; l < e;) {
            d = (l - l % 4) / 4, f = l % 4 * 8, h[d] |= c.charCodeAt(l) << f, l++;
        }
        d = (l - l % 4) / 4;
        h[d] |= 128 << l % 4 * 8;
        h[g - 2] = e << 3;
        h[g - 1] = e >>> 29;
        return h;
    }(f);
    p = 1732584193;
    q = 4023233417;
    r = 2562383102;
    t = 271733878;
    for (f = 0; f < k.length; f += 16) {
        m = p, n = q, u = r, v = t, p = d(p, q, r, t, k[f + 0], 7, 3614090360), t = d(t, p, q, r, k[f + 1], 12, 3905402710), r = d(r, t, p, q, k[f + 2], 17, 606105819), q = d(q, r, t, p, k[f + 3], 22, 3250441966), p = d(p, q, r, t, k[f + 4], 7, 4118548399), t = d(t, p, q, r, k[f + 5], 12, 1200080426), r = d(r, t, p, q, k[f + 6], 17, 2821735955), q = d(q, r, t, p, k[f + 7], 22, 4249261313), p = d(p, q, r, t, k[f + 8], 7, 1770035416), t = d(t, p, q, r, k[f + 9], 12, 2336552879), r = d(r, t, p, q, k[f + 10], 17, 4294925233), q = d(q, r, t, p, k[f + 11], 22, 2304563134), p = d(p, q, r, t, k[f + 12], 7, 1804603682), t = d(t, p, q, r, k[f + 13], 12, 4254626195), r = d(r, t, p, q, k[f + 14], 17, 2792965006), q = d(q, r, t, p, k[f + 15], 22, 1236535329), p = e(p, q, r, t, k[f + 1], 5, 4129170786), t = e(t, p, q, r, k[f + 6], 9, 3225465664), r = e(r, t, p, q, k[f + 11], 14, 643717713), q = e(q, r, t, p, k[f + 0], 20, 3921069994), p = e(p, q, r, t, k[f + 5], 5, 3593408605), t = e(t, p, q, r, k[f + 10], 9, 38016083), r = e(r, t, p, q, k[f + 15], 14, 3634488961), q = e(q, r, t, p, k[f + 4], 20, 3889429448), p = e(p, q, r, t, k[f + 9], 5, 568446438), t = e(t, p, q, r, k[f + 14], 9, 3275163606), r = e(r, t, p, q, k[f + 3], 14, 4107603335), q = e(q, r, t, p, k[f + 8], 20, 1163531501), p = e(p, q, r, t, k[f + 13], 5, 2850285829), t = e(t, p, q, r, k[f + 2], 9, 4243563512), r = e(r, t, p, q, k[f + 7], 14, 1735328473), q = e(q, r, t, p, k[f + 12], 20, 2368359562), p = g(p, q, r, t, k[f + 5], 4, 4294588738), t = g(t, p, q, r, k[f + 8], 11, 2272392833), r = g(r, t, p, q, k[f + 11], 16, 1839030562), q = g(q, r, t, p, k[f + 14], 23, 4259657740), p = g(p, q, r, t, k[f + 1], 4, 2763975236), t = g(t, p, q, r, k[f + 4], 11, 1272893353), r = g(r, t, p, q, k[f + 7], 16, 4139469664), q = g(q, r, t, p, k[f + 10], 23, 3200236656), p = g(p, q, r, t, k[f + 13], 4, 681279174), t = g(t, p, q, r, k[f + 0], 11, 3936430074), r = g(r, t, p, q, k[f + 3], 16, 3572445317), q = g(q, r, t, p, k[f + 6], 23, 76029189), p = g(p, q, r, t, k[f + 9], 4, 3654602809), t = g(t, p, q, r, k[f + 12], 11, 3873151461), r = g(r, t, p, q, k[f + 15], 16, 530742520), q = g(q, r, t, p, k[f + 2], 23, 3299628645), p = h(p, q, r, t, k[f + 0], 6, 4096336452), t = h(t, p, q, r, k[f + 7], 10, 1126891415), r = h(r, t, p, q, k[f + 14], 15, 2878612391), q = h(q, r, t, p, k[f + 5], 21, 4237533241), p = h(p, q, r, t, k[f + 12], 6, 1700485571), t = h(t, p, q, r, k[f + 3], 10, 2399980690), r = h(r, t, p, q, k[f + 10], 15, 4293915773), q = h(q, r, t, p, k[f + 1], 21, 2240044497), p = h(p, q, r, t, k[f + 8], 6, 1873313359), t = h(t, p, q, r, k[f + 15], 10, 4264355552), r = h(r, t, p, q, k[f + 6], 15, 2734768916), q = h(q, r, t, p, k[f + 13], 21, 1309151649), p = h(p, q, r, t, k[f + 4], 6, 4149444226), t = h(t, p, q, r, k[f + 11], 10, 3174756917), r = h(r, t, p, q, k[f + 2], 15, 718787259), q = h(q, r, t, p, k[f + 9], 21, 3951481745), p = c(p, m), q = c(q, n), r = c(r, u), t = c(t, v);
    }
    return (l(p) + l(q) + l(r) + l(t)).toLowerCase();
}
String.format = function() {
    for (var f = arguments[0], c = 0; c < arguments.length - 1; c++) {
        f = f.replace(new RegExp("\\{" + c + "\\}", "gm"), arguments[c + 1]);
    }
    return f;
};
String.prototype.endsWith = function(f) {
    return this.substr(this.length - f.length) === f;
};
String.prototype.startsWith = function(f) {
    return this.substr(0, f.length) === f;
};
jQuery.fn.Pq = function(f, c) {
    return this.each(function() {
        jQuery(this).fadeIn(f, function() {
            eb.browser.msie ? $(this).get(0).style.removeAttribute("filter") : "";
            "function" == typeof eval(c) ? eval(c)() : "";
        });
    });
};
jQuery.fn.jn = function(f) {
    this.each(function() {
        eb.browser.msie ? eval(f)() : jQuery(this).fadeOut(400, function() {
            eb.browser.msie ? $(this).get(0).style.removeAttribute("filter") : "";
            "function" == typeof eval(f) ? eval(f)() : "";
        });
    });
};
jQuery.fn.kr = function(f, c) {
    if (0 <= jQuery.fn.jquery.indexOf("1.8")) {
        try {
            if (void 0 === jQuery._data(this[0], "events")) {
                return !1;
            }
        } catch (g) {
            return !1;
        }
        var d = jQuery._data(this[0], "events")[f];
        if (void 0 === d || 0 === d.length) {
            return !1;
        }
        var e = 0;
    } else {
        if (void 0 === this.data("events")) {
            return !1;
        }
        d = this.data("events")[f];
        if (void 0 === d || 0 === d.length) {
            return !1;
        }
        e = 0;
    }
    for (; e < d.length; e++) {
        if (d[e].handler == c) {
            return !0;
        }
    }
    return !1;
};
jQuery.fn.Qr = function(f) {
    if (void 0 === this.data("events")) {
        return !1;
    }
    var c = this.data("events")[f];
    if (void 0 === c || 0 === c.length) {
        return !1;
    }
    for (var d = 0; d < c.length; d++) {
        jQuery(this).unbind(f, c[d].handler);
    }
    return !1;
};
jQuery.fn.vr = function() {
    eb.browser.rb.Bb ? this.scrollTo(ce, 0, {
        axis: "xy",
        offset: -30
    }) : this.data("jsp").scrollToElement(ce, !1);
};
jQuery.fn.dj = function(f, c) {
    this.css({
        width: 0,
        height: 0,
        "border-bottom": String.format("{0}px solid transparent", f),
        "border-top": String.format("{0}px solid transparent", f),
        "border-right": String.format("{0}px solid {1}", f, c),
        "font-size": "0px",
        "line-height": "0px",
        cursor: "pointer"
    });
    this.on("mouseover", function(c) {
        jQuery(c.target).css({
            "border-right": String.format("{0}px solid {1}", f, "#DEDEDE")
        });
    });
    this.on("mouseout", function(d) {
        jQuery(d.target).css({
            "border-right": String.format("{0}px solid {1}", f, c)
        });
    });
};
jQuery.fn.zo = function(f, c, d) {
    this.css({
        width: 0,
        height: 0,
        "border-bottom": String.format("{0}px solid {1}", f, c),
        "border-top": String.format("{0}px solid {1}", f, c),
        "border-left": String.format("1px solid {1}", f, c),
        "font-size": "0px",
        "line-height": "0px",
        cursor: "pointer"
    });
    this.on("mouseover", function(c) {
        jQuery(d).trigger("mouseover");
        jQuery(c.target).css({
            "border-left": String.format("1px solid {1}", f, "#DEDEDE"),
            "border-bottom": String.format("{0}px solid {1}", f, "#DEDEDE"),
            "border-top": String.format("{0}px solid {1}", f, "#DEDEDE")
        });
    });
    this.on("mouseout", function(e) {
        jQuery(d).trigger("mouseout");
        jQuery(e.target).css({
            "border-left": String.format("1px solid {1}", f, c),
            "border-bottom": String.format("{0}px solid {1}", f, c),
            "border-top": String.format("{0}px solid {1}", f, c)
        });
    });
};
jQuery.fn.ej = function(f, c) {
    this.css({
        width: 0,
        height: 0,
        "border-bottom": String.format("{0}px solid transparent", f),
        "border-top": String.format("{0}px solid transparent", f),
        "border-left": String.format("{0}px solid {1}", f, c),
        "font-size": "0px",
        "line-height": "0px",
        cursor: "pointer"
    });
    this.on("mouseover", function(c) {
        jQuery(c.target).css({
            "border-left": String.format("{0}px solid {1}", f, "#DEDEDE")
        });
    });
    this.on("mouseout", function(d) {
        jQuery(d.target).css({
            "border-left": String.format("{0}px solid {1}", f, c)
        });
    });
};
jQuery.fn.Ao = function(f, c, d) {
    this.css({
        width: 0,
        height: 0,
        "border-bottom": String.format("{0}px solid {1}", f, c),
        "border-top": String.format("{0}px solid {1}", f, c),
        "border-right": String.format("1px solid {1}", f, c),
        "font-size": "0px",
        "line-height": "0px",
        cursor: "pointer"
    });
    this.on("mouseover", function(c) {
        jQuery(d).trigger("mouseover");
        jQuery(c.target).css({
            "border-right": String.format("1px solid {1}", f, "#DEDEDE"),
            "border-top": String.format("{0}px solid {1}", f, "#DEDEDE"),
            "border-bottom": String.format("{0}px solid {1}", f, "#DEDEDE")
        });
    });
    this.on("mouseout", function(e) {
        jQuery(d).trigger("mouseout");
        jQuery(e.target).css({
            "border-right": String.format("1px solid {1}", f, c),
            "border-top": String.format("{0}px solid {1}", f, c),
            "border-bottom": String.format("{0}px solid {1}", f, c)
        });
    });
};
jQuery.fn.addClass5 = function(f) {
    return this[0].classList ? (this[0].classList.add(f), this) : this.addClass(f);
};
jQuery.fn.removeClass5 = function(f) {
    return this[0].classList ? (this[0].classList.remove(f), this) : this.addClass(f);
};
jQuery.fn.Vg = function() {
    this.css({
        display: "none"
    });
};
jQuery.fn.mg = function() {
    this.css({
        display: "block"
    });
};
window.requestAnim = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(f) {
    window.setTimeout(f, 1000 / 60);
};
jQuery.fn.mf = function() {
    var f = this.css("transform");
    return !f || "none" == f || "0px,0px" == f.translate && 1 == parseFloat(f.scale) ? !1 : !0;
};

function ca(f, c) {
    var d = "0",
        e = f = f + "";
    if (null == d || 1 > d.length) {
        d = " ";
    }
    if (f.length < c) {
        for (var e = "", g = 0; g < c - f.length; g++) {
            e += d;
        }
        e += f;
    }
    return e;
}
jQuery.fn.spin = function(f) {
    this.each(function() {
        var c = jQuery(this),
            d = c.data();
        d.uj && (d.uj.stop(), delete d.uj);
        !1 !== f && (d.uj = (new Spinner(jQuery.extend({
            color: c.css("color")
        }, f))).spin(this));
    });
    return this;
};
jQuery.fn.Sn = function() {
    var f = jQuery.extend({
        fk: "cur",
        Wk: !1,
        speed: 300
    }, {
        Wk: !1,
        speed: 100
    });
    this.each(function() {
        var c = jQuery(this).addClass("harmonica"),
            d = jQuery("ul", c).prev("a");
        c.children(":last").addClass("last");
        jQuery("ul", c).each(function() {
            jQuery(this).children(":last").addClass("last");
        });
        jQuery("ul", c).prev("a").addClass("harFull");
        c.find("." + f.fk).parents("ul").show().prev("a").addClass(f.fk).addClass("harOpen");
        d.on("click", function() {
            jQuery(this).next("ul").is(":hidden") ? jQuery(this).addClass("harOpen") : jQuery(this).removeClass("harOpen");
            f.Wk ? (jQuery(this).closest("ul").closest("ul").find("ul").not(jQuery(this).next("ul")).slideUp(f.speed).prev("a").removeClass("harOpen"), jQuery(this).next("ul").slideToggle(f.speed)) : jQuery(this).next("ul").stop(!0).slideToggle(f.speed);
            return !1;
        });
    });
};

function da(f, c) {
    var d = jQuery("<ul>");
    jQuery.each(c, function(c, g) {
        var h = jQuery("<li>").appendTo(d),
            l = jQuery(g).children("node");
        jQuery('<a class="flowpaper_accordionLabel flowpaper-tocitem" data-pageNumber="' + g.getAttribute("pageNumber") + '">').text(unescape(g.getAttribute("title"))).appendTo(h);
        0 < l.length && da(f, l).appendTo(h);
    });
    return d;
}

function Q(f) {
    return (f = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(f)) ? {
        r: parseInt(f[1], 16),
        g: parseInt(f[2], 16),
        b: parseInt(f[3], 16)
    } : null;
}
jQuery.Yf = function(f, c, d) {
    f = f.offset();
    return {
        x: Math.floor(c - f.left),
        y: Math.floor(d - f.top)
    };
};
jQuery.fn.Yf = function(f, c) {
    return jQuery.Yf(this.first(), f, c);
};
(function(f) {
    f.fn.moveTo = function(c) {
        return this.each(function() {
            var d = f(this).clone();
            f(d).appendTo(c);
            f(this).remove();
        });
    };
})(jQuery);

function ea(f) {
    return f.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g, "").replace(/\s+/g, " ");
}

function R(f) {
    window.di || (window.di = 1);
    if (!window.kk) {
        var c = window,
            d = document.createElement("div");
        document.body.appendChild(d);
        d.style.position = "absolute";
        d.style.width = "1in";
        var e = d.offsetWidth;
        d.style.display = "none";
        c.kk = e;
    }
    return f / (72 / window.kk) * window.di;
}

function S(f) {
    f = f.replace(/-/g, "-\x00").split(/(?=-| )|\0/);
    for (var c = [], d = 0; d < f.length; d++) {
        "-" == f[d] && d + 1 <= f.length ? (c[c.length] = -1 * parseFloat(ea(f[d + 1].toString())), d++) : c[c.length] = parseFloat(ea(f[d].toString()));
    }
    return c;
}
FLOWPAPER.yj = function(f, c) {
    if (0 < f.indexOf("[*,2]") || 0 < f.indexOf("[*,1]")) {
        var d = f.substr(f.indexOf("[*,"), f.indexOf("]") - f.indexOf("[*,") + 1);
        return f.replace(d, ca(c, parseInt(d.substr(d.indexOf(",") + 1, d.indexOf("]") - 2))));
    }
    return 0 < f.indexOf("[*,2,true]") ? f.replace("_[*,2,true]", "") : 0 < f.indexOf("[*,1,true]") ? f.replace("_[*,1,true]", "") : 0 < f.indexOf("[*,0,true]") ? f.replace("_[*,0,true]", "") : f;
};
FLOWPAPER.un = function() {
    for (var f = "", c = 0; 10 > c; c++) {
        f += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(62 * Math.random()));
    }
    return f;
};
FLOWPAPER.mr = function(f) {
    return "#" != f.charAt(0) && "/" != f.charAt(0) && (-1 == f.indexOf("//") || f.indexOf("//") > f.indexOf("#") || f.indexOf("//") > f.indexOf("?"));
};
FLOWPAPER.Dq = function(f, c, d, e, g, h, l) {
    if (e < c) {
        var k = c;
        c = e;
        e = k;
        k = d;
        d = g;
        g = k;
    }
    k = document.createElement("div");
    k.id = f + "_line";
    k.className = "flowpaper_cssline flowpaper_annotation_" + l + " flowpaper_interactiveobject_" + l;
    f = Math.sqrt((c - e) * (c - e) + (d - g) * (d - g));
    k.style.width = f + "px";
    k.style.marginLeft = h;
    e = Math.atan((g - d) / (e - c));
    k.style.top = d + 0.5 * f * Math.sin(e) + "px";
    k.style.left = c - 0.5 * f * (1 - Math.cos(e)) + "px";
    k.style.MozTransform = k.style.WebkitTransform = k.style.msTransform = k.style.Db = "rotate(" + e + "rad)";
    return k;
};
FLOWPAPER.Er = function(f, c, d, e, g, h) {
    if (e < c) {
        var l = c;
        c = e;
        e = l;
        l = d;
        d = g;
        g = l;
    }
    f = jQuery("#" + f + "_line");
    l = Math.sqrt((c - e) * (c - e) + (d - g) * (d - g));
    f.css("width", l + "px");
    e = Math.atan((g - d) / (e - c));
    f.css("top", d + 0.5 * l * Math.sin(e) + "px");
    f.css("left", c - 0.5 * l * (1 - Math.cos(e)) + "px");
    f.css("margin-left", h);
    f.css("-moz-transform", "rotate(" + e + "rad)");
    f.css("-webkit-transform", "rotate(" + e + "rad)");
    f.css("-o-transform", "rotate(" + e + "rad)");
    f.css("-ms-transform", "rotate(" + e + "rad)");
};
FLOWPAPER.Nq = function() {
    eb.browser.mozilla ? jQuery(".flowpaper_interactive_canvas").addClass("flowpaper_interactive_canvas_drawing_moz") : eb.browser.msie || eb.browser.Ti ? jQuery(".flowpaper_interactive_canvas").addClass("flowpaper_interactive_canvas_drawing_ie") : jQuery(".flowpaper_interactive_canvas").addClass("flowpaper_interactive_canvas_drawing");
};
FLOWPAPER.Hq = function() {
    jQuery(".flowpaper_interactive_canvas").removeClass("flowpaper_interactive_canvas_drawing");
    jQuery(".flowpaper_interactive_canvas").removeClass("flowpaper_interactive_canvas_drawing_moz");
    jQuery(".flowpaper_interactive_canvas").removeClass("flowpaper_interactive_canvas_drawing_ie");
};
var ImagePageRenderer = window.ImagePageRenderer = function() {
        function f(c, d, e) {
            this.ja = c;
            this.config = d;
            this.Ld = d.jsonfile;
            this.jsDirectory = e;
            this.pageImagePattern = d.pageImagePattern;
            this.pageThumbImagePattern = d.pageThumbImagePattern;
            this.pageSVGImagePattern = d.pageSVGImagePattern;
            this.Zi = d.pageHighResImagePattern;
            this.JSONPageDataFormat = this.mb = this.dimensions = null;
            this.Sa = null != d.compressedJSONFormat ? d.compressedJSONFormat : !0;
            this.oa = null;
            this.tc = "pageLoader_[pageNumber]";
            this.jd = "data:image/gif;base64,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%3D%3D";
            this.wa = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            this.Ie = -1;
            this.Wa = null;
            this.qf = !1;
            this.ce = this.vb = !0;
            this.Jb = d.SVGMode;
        }
        f.prototype = {
            lf: function() {
                return "ImagePageRenderer";
            },
            Pa: function(c) {
                return c.aa.ca ? c.aa.ca.na : "";
            },
            xb: function(c) {
                return c.aa.ca.Kn;
            },
            dispose: function() {
                jQuery(this.Wa).unbind();
                this.Wa.dispose();
                delete this.gd;
                this.gd = null;
                delete this.dimensions;
                this.dimensions = null;
                delete this.Wa;
                this.Wa = null;
                delete this.oa;
                this.oa = null;
            },
            initialize: function(c) {
                var d = this;
                d.gd = c;
                d.Sa ? d.JSONPageDataFormat = {
                    Qe: "width",
                    Pe: "height",
                    we: "text",
                    Qb: "d",
                    ng: "f",
                    xd: "l",
                    yd: "t",
                    zd: "w",
                    wd: "h"
                } : d.JSONPageDataFormat = {
                    Qe: d.config.JSONPageDataFormat.pageWidth,
                    Pe: d.config.JSONPageDataFormat.pageHeight,
                    we: d.config.JSONPageDataFormat.textCollection,
                    Qb: d.config.JSONPageDataFormat.textFragment,
                    ng: d.config.JSONPageDataFormat.textFont,
                    xd: d.config.JSONPageDataFormat.textLeft,
                    yd: d.config.JSONPageDataFormat.textTop,
                    zd: d.config.JSONPageDataFormat.textWidth,
                    wd: d.config.JSONPageDataFormat.textHeight
                };
                d.Wa = new fa(d.ja, d.Sa, d.JSONPageDataFormat, !0);
                jQuery.ajaxPrefilter(function(c, d, e) {
                    if (c.onreadystatechange) {
                        var f = c.xhr;
                        c.xhr = function() {
                            function d() {
                                c.onreadystatechange(h, e);
                            }
                            var h = f.apply(this, arguments);
                            h.addEventListener ? h.addEventListener("readystatechange", d, !1) : setTimeout(function() {
                                var c = h.onreadystatechange;
                                c && (h.onreadystatechange = function() {
                                    d();
                                    c.apply(this, arguments);
                                });
                            }, 0);
                            return h;
                        };
                    }
                });
                if (!eb.browser.msie && !eb.browser.safari && 6 > eb.browser.Hb) {
                    var e = jQuery.ajaxSettings.xhr;
                    jQuery.ajaxSettings.xhr = function() {
                        var c = e();
                        c instanceof window.XMLHttpRequest && c.addEventListener("progress", function(c) {
                            c.lengthComputable && (c = c.loaded / c.total, jQuery("#toolbar").trigger("onProgressChanged", c));
                        }, !1);
                        return c;
                    };
                }
                jQuery("#" + d.ja).trigger("onDocumentLoading");
                c = document.createElement("a");
                c.href = d.Ld;
                c.search += 0 < c.search.length ? "&" : "?";
                c.search += "callback=?";
                d.Bq = !1;
                jQuery(d).trigger("loadingProgress", {
                    ja: d.ja,
                    progress: 0.3
                });
                0 < d.Ld.indexOf("{page}") ? (d.Ha = !0, jQuery.ajax({
                    url: d.af(10),
                    dataType: d.config.JSONDataType,
                    success: function(c) {
                        jQuery(d).trigger("loadingProgress", {
                            ja: d.ja,
                            progress: 0.9
                        });
                        c.e && (c = CryptoJS.Ae.decrypt(c.e, CryptoJS.nc.ze.parse(eb.Sg ? P() : eb.Xd.innerHTML)), c = jQuery.parseJSON(c.toString(CryptoJS.nc.Kf)), d.Ve = !0);
                        if (0 < c.length) {
                            d.oa = Array(c[0].pages);
                            for (var e = 0; e < c.length; e++) {
                                d.oa[e] = c[e], d.oa[e].loaded = !0;
                            }
                            for (e = 0; e < d.oa.length; e++) {
                                null == d.oa[e] && (d.oa[e] = [], d.oa[e].loaded = !1);
                            }
                            0 < d.oa.length && (d.nb = d.oa[0].twofold, d.nb && (d.rd = 1));
                            d.gd();
                            d.Wa.Df(c);
                        }
                    },
                    error: function(c, e, f) {
                        O("Error loading JSON file (" + c.statusText + "," + f + "). Please check your configuration.", "onDocumentLoadedError", d.ja, null != c.responseText && 0 == c.responseText.indexOf("Error:") ? c.responseText.substr(6) : "");
                    }
                })) : jQuery.ajax({
                    url: d.Ld,
                    dataType: d.config.JSONDataType,
                    success: function(c) {
                        jQuery(d).trigger("loadingProgress", {
                            ja: d.ja,
                            progress: 0.9
                        });
                        c.e && (c = CryptoJS.Ae.decrypt(c.e, CryptoJS.nc.ze.parse(eb.Sg ? P() : eb.Xd.innerHTML)), c = jQuery.parseJSON(c.toString(CryptoJS.nc.Kf)), d.Ve = !0);
                        for (var e = 0; e < c.length; e++) {
                            c[e].loaded = !0;
                        }
                        d.oa = c;
                        d.gd();
                        d.Wa.Df(c);
                    },
                    onreadystatechange: function() {},
                    error: function(c, e, f) {
                        O("Error loading JSON file (" + c.statusText + "," + f + "). Please check your configuration.", "onDocumentLoadedError", d.ja, null != c.responseText && 0 == c.responseText.indexOf("Error:") ? c.responseText.substr(6) : "");
                    }
                });
            },
            getDimensions: function(c, d) {
                var e = this.oa.length;
                null == c && (c = 0);
                null == d && (d = e);
                if (null == this.dimensions || d && c) {
                    for (null == this.dimensions && (this.dimensions = [], this.mb = []), e = c; e < d; e++) {
                        this.oa[e].loaded ? (this.dimensions[e] = [], this.ul(e), null == this.mc && (this.mc = this.dimensions[e])) : null != this.mc && (this.dimensions[e] = [], this.dimensions[e].page = e, this.dimensions[e].loaded = !1, this.dimensions[e].width = this.mc.width, this.dimensions[e].height = this.mc.height, this.dimensions[e].Ca = this.mc.Ca, this.dimensions[e].Na = this.mc.Na);
                    }
                }
                return this.dimensions;
            },
            ul: function(c) {
                if (this.dimensions[c]) {
                    this.dimensions[c].page = c;
                    this.dimensions[c].loaded = !0;
                    this.dimensions[c].width = this.oa[c][this.JSONPageDataFormat.Qe];
                    this.dimensions[c].height = this.oa[c][this.JSONPageDataFormat.Pe];
                    this.dimensions[c].Ca = this.dimensions[c].width;
                    this.dimensions[c].Na = this.dimensions[c].height;
                    this.mb[c] = [];
                    this.mb[c] = "";
                    900 < this.dimensions[c].width && (this.dimensions[c].width = 918, this.dimensions[c].height = 1188);
                    for (var d = 0, e; e = this.oa[c][this.JSONPageDataFormat.we][d++];) {
                        this.Sa ? !isNaN(e[0].toString()) && 0 <= Number(e[0].toString()) && !isNaN(e[1].toString()) && 0 <= Number(e[1].toString()) && !isNaN(e[2].toString()) && 0 < Number(e[2].toString()) && !isNaN(e[3].toString()) && 0 < Number(e[3].toString()) && (this.mb[c] += e[5]) : !isNaN(e[this.JSONPageDataFormat.xd].toString()) && 0 <= Number(e[this.JSONPageDataFormat.xd].toString()) && !isNaN(e[this.JSONPageDataFormat.yd].toString()) && 0 <= Number(e[this.JSONPageDataFormat.yd].toString()) && !isNaN(e[this.JSONPageDataFormat.zd].toString()) && 0 < Number(e[this.JSONPageDataFormat.zd].toString()) && !isNaN(e[this.JSONPageDataFormat.wd].toString()) && 0 < Number(e[this.JSONPageDataFormat.wd].toString()) && (this.mb[c] += e[this.JSONPageDataFormat.Qb]);
                    }
                    this.mb[c] = this.mb[c].toLowerCase();
                }
            },
            Jd: function(c) {
                this.tb = !1;
                if ("Portrait" == c.ba || "SinglePage" == c.ba) {
                    "Portrait" == c.ba && c.ga(c.ma).addClass("flowpaper_hidden"), this.Jb ? c.ga(c.Ia).append("<object data='" + this.wa + "' type='image/svg+xml' id='" + c.page + "' class='flowpaper_interactivearea " + (this.config.DisableShadows ? "" : "flowpaper_border") + " flowpaper_grab flowpaper_hidden flowpaper_rescale' style='" + c.getDimensions() + "' /></div>") : c.ga(c.Ia).append("<img alt='' src='" + this.wa + "' id='" + c.page + "' class='flowpaper_interactivearea " + (this.config.DisableShadows ? "" : "flowpaper_border") + " flowpaper_grab flowpaper_hidden flowpaper_rescale' style='" + c.getDimensions() + ";background-size:cover;' />"), "SinglePage" == c.ba && 0 == c.pageNumber && this.Zg(c, c.ma);
                }
                "ThumbView" == c.ba && jQuery(c.ma).append("<img src='" + this.wa + "' alt='" + this.za(c.pageNumber + 1) + "'  id='" + c.page + "' class='flowpaper_hidden' style='" + c.getDimensions() + "'/>");
                c.ba == this.Pa(c) && this.xb(c).Jd(this, c);
                if ("TwoPage" == c.ba || "BookView" == c.ba) {
                    0 == c.pageNumber && (jQuery(c.ma + "_1").append("<img id='" + c.tc + "_1' class='flowpaper_pageLoader' src='" + this.jd + "' style='position:absolute;left:50%;top:" + c.Za() / 4 + "px;margin-left:-32px;' />"), jQuery(c.ma + "_1").append("<img src='" + this.wa + "' alt='" + this.za(c.pageNumber + 1) + "'  id='" + c.page + "' class='flowpaper_interactivearea flowpaper_grab flowpaper_hidden flowpaper_load_on_demand' style='" + c.getDimensions() + ";position:absolute;background-size:cover;'/>"), jQuery(c.ma + "_1").append("<div id='" + c.pa + "_1_textoverlay' style='position:relative;left:0px;top:0px;width:100%;height:100%;'></div>")), 1 == c.pageNumber && (jQuery(c.ma + "_2").append("<img id='" + c.tc + "_2' class='flowpaper_pageLoader' src='" + this.jd + "' style='position:absolute;left:50%;top:" + c.Za() / 4 + "px;margin-left:-32px;' />"), jQuery(c.ma + "_2").append("<img src='" + this.wa + "' alt='" + this.za(c.pageNumber + 1) + "'  id='" + c.page + "' class='flowpaper_interactivearea flowpaper_grab flowpaper_hidden flowpaper_load_on_demand' style='" + c.getDimensions() + ";position:absolute;left:0px;top:0px;background-size:cover;'/>"), jQuery(c.ma + "_2").append("<div id='" + c.pa + "_2_textoverlay' style='position:absolute;left:0px;top:0px;width:100%;height:100%;'></div>"));
                }
            },
            af: function(c) {
                return this.Ld.replace("{page}", c);
            },
            za: function(c, d, e) {
                this.config.PageIndexAdjustment && (c += this.config.PageIndexAdjustment);
                this.Ve && (c = CryptoJS.Ae.encrypt(c.toString(), CryptoJS.nc.ze.parse(eb.Sg ? P() : eb.Xd.innerHTML)).toString());
                return !e || e && !this.pageSVGImagePattern ? d ? null != this.pageThumbImagePattern && 0 < this.pageThumbImagePattern.length ? 0 < this.pageThumbImagePattern.indexOf("?") ? this.pageThumbImagePattern.replace("{page}", c) + "&resolution=" + d : this.pageThumbImagePattern.replace("{page}", c) + "?resolution=" + d : 0 < this.pageImagePattern.indexOf("?") ? this.pageImagePattern.replace("{page}", c) + "&resolution=" + d : this.pageImagePattern.replace("{page}", c) + "?resolution=" + d : this.pageImagePattern.replace("{page}", c) : d ? null != this.pageThumbImagePattern && 0 < this.pageThumbImagePattern.length ? this.pageThumbImagePattern.replace("{page}", c) : 0 < this.pageSVGImagePattern.indexOf("?") ? this.pageSVGImagePattern.replace("{page}", c) + "&resolution=" + d : this.pageSVGImagePattern.replace("{page}", c) + "?resolution=" + d : this.pageSVGImagePattern.replace("{page}", c);
            },
            Mb: function(c, d) {
                return this.Zi.replace("{page}", c).replace("{sector}", d);
            },
            Wf: function(c) {
                return c + (10 - c % 10);
            },
            Rc: function(c, d, e) {
                var g = this;
                g.kd != g.Wf(c) && (g.kd = g.Wf(c), jQuery.ajax({
                    url: g.af(g.kd),
                    dataType: g.config.JSONDataType,
                    async: d,
                    success: function(c) {
                        c.e && (c = CryptoJS.Ae.decrypt(c.e, CryptoJS.nc.ze.parse(eb.Sg ? P() : eb.Xd.innerHTML)), c = jQuery.parseJSON(c.toString(CryptoJS.nc.Kf)), g.Ve = !0);
                        if (0 < c.length) {
                            for (var d = 0; d < c.length; d++) {
                                var f = parseInt(c[d].number) - 1;
                                g.oa[f] = c[d];
                                g.oa[f].loaded = !0;
                                g.ul(f);
                            }
                            g.Wa.Df(g.oa);
                            jQuery(g).trigger("onTextDataUpdated");
                            null != e && e();
                        }
                        g.kd = null;
                    },
                    error: function(c) {
                        O("Error loading JSON file (" + c.statusText + "). Please check your configuration.", "onDocumentLoadedError", g.ja);
                        g.kd = null;
                    }
                }));
            },
            Ma: function(c) {
                return c.Ie;
            },
            Oa: function(c, d) {
                c.Ie = d;
            },
            Pb: function(c, d, e) {
                var g = this;
                if (!c.Fa || c.ba == g.Pa(c)) {
                    if (c.ba != g.Pa(c) && -1 < g.Ma(c)) {
                        window.clearTimeout(c.gc), c.gc = setTimeout(function() {
                            g.Pb(c, d, e);
                        }, 250);
                    } else {
                        var h = c.Uc + "_textLayer";
                        jQuery("#" + h).remove();
                        0 != jQuery("#" + h).length || "Portrait" != c.ba && "SinglePage" != c.ba && "TwoPage" != c.ba && "BookView" != c.ba && c.ba != g.Pa(c) || (h = "<div id='" + h + "' class='flowpaper_textLayer flowpaper_pageword_" + g.ja + "' style='width:" + c.Va() + "px;height:" + c.Za() + "px;'></div>", "Portrait" == c.ba || g.Pa(c) ? jQuery(c.Ia).append(h) : "TwoPage" != c.ba && "BookView" != c.ba || jQuery(c.Ia + "_" + (c.pageNumber % 2 + 1)).append(h), 90 != c.rotation && 270 != c.rotation && 180 != c.rotation) || (jQuery(c.Ub).css({
                            "z-index": 11,
                            "margin-left": ml
                        }), jQuery(c.Ub).transition({
                            rotate: c.rotation,
                            translate: "-" + ml + "px, 0px"
                        }, 0));
                        if ("Portrait" == c.ba || "ThumbView" == c.ba) {
                            c.Fa || jQuery(c.Ka).attr("src") != g.wa && !g.Jb || c.nf || (g.Oa(c, c.pageNumber), c.dimensions.loaded || g.Rc(c.pageNumber + 1, !0, function() {
                                g.lc(c);
                            }), c.vd(), g.va = new Image, jQuery(g.va).bind("load", function() {
                                c.nf = !0;
                                c.bg = this.height;
                                c.cg = this.width;
                                g.Dc(c);
                                c.dimensions.Ca > c.dimensions.width && (c.dimensions.width = c.dimensions.Ca, c.dimensions.height = c.dimensions.Na, "Portrait" != c.ba && "SinglePage" != c.ba || c.Xa());
                            }).bind("error", function() {
                                O("Error loading image (" + this.src + ")", "onErrorLoadingPage", g.ja, c.pageNumber);
                            }), jQuery(g.va).bind("error", function() {
                                g.Oa(c, -1);
                            }), jQuery(g.va).attr("src", g.za(c.pageNumber + 1, "ThumbView" == c.ba ? 200 : null))), !c.Fa && jQuery(c.Ka).attr("src") == g.wa && c.nf && g.Dc(c), null != e && e();
                        }
                        c.ba == g.Pa(c) && (c.dimensions.loaded || g.Rc(c.pageNumber + 1, !0, function() {
                            g.lc(c);
                        }), g.xb(c).Pb(g, c, d, e));
                        "SinglePage" == c.ba && (c.qc || (c.vd(), c.qc = !0), 0 == c.pageNumber && (g.Oa(c, c.pages.la), g.getDimensions()[g.Ma(c)].loaded || g.Rc(g.Ma(c) + 1, !0, function() {
                            g.lc(c);
                        }), g.va = new Image, jQuery(g.va).bind("load", function() {
                            c.nf = !0;
                            c.bg = this.height;
                            c.cg = this.width;
                            c.oc();
                            g.Dc(c);
                            c.dimensions.Ca > c.dimensions.width && (c.dimensions.width = c.dimensions.Ca, c.dimensions.height = c.dimensions.Na, c.Xa());
                            c.Fa || jQuery("#" + g.ja).trigger("onPageLoaded", c.pageNumber + 1);
                            c.Fa = !0;
                            g.Oa(c, -1);
                        }), jQuery(g.va).bind("error", function() {
                            c.oc();
                            g.Oa(c, -1);
                        }), jQuery(g.va).attr("src", g.za(c.pages.la + 1)), jQuery(c.ma + "_1").removeClass("flowpaper_load_on_demand"), null != e && e()));
                        if ("TwoPage" == c.ba || "BookView" == c.ba) {
                            c.qc || (c.vd(), c.qc = !0), 0 == c.pageNumber ? (jQuery(c.Ka), "BookView" == c.ba ? g.Oa(c, 0 != c.pages.la ? c.pages.la : c.pages.la + 1) : "TwoPage" == c.ba && g.Oa(c, c.pages.la), g.getDimensions()[g.Ma(c) - 1] && !g.getDimensions()[g.Ma(c) - 1].loaded && g.Rc(g.Ma(c) + 1, !0, function() {
                                g.lc(c);
                            }), g.va = new Image, jQuery(g.va).bind("load", function() {
                                c.nf = !0;
                                c.bg = this.height;
                                c.cg = this.width;
                                c.oc();
                                g.Dc(c);
                                c.dimensions.Ca > c.dimensions.width && (c.dimensions.width = c.dimensions.Ca, c.dimensions.height = c.dimensions.Na, c.Xa());
                                c.Fa || jQuery("#" + g.ja).trigger("onPageLoaded", c.pageNumber + 1);
                                c.Fa = !0;
                                g.Oa(c, -1);
                            }), jQuery(g.va).bind("error", function() {
                                c.oc();
                                g.Oa(c, -1);
                            }), "BookView" == c.ba && jQuery(g.va).attr("src", g.za(0 != c.pages.la ? c.pages.la : c.pages.la + 1)), "TwoPage" == c.ba && jQuery(g.va).attr("src", g.za(c.pages.la + 1)), jQuery(c.ma + "_1").removeClass("flowpaper_load_on_demand"), null != e && e()) : 1 == c.pageNumber && (h = jQuery(c.Ka), c.pages.la + 1 > c.pages.getTotalPages() ? h.attr("src", "") : (0 != c.pages.la || "TwoPage" == c.ba ? (g.Oa(c, c.pages.la + 1), g.va = new Image, jQuery(g.va).bind("load", function() {
                                c.oc();
                                g.Dc(c);
                                c.dimensions.Ca > c.dimensions.width && (c.dimensions.width = c.dimensions.Ca, c.dimensions.height = c.dimensions.Na);
                                c.Fa || jQuery("#" + g.ja).trigger("onPageLoaded", c.pageNumber + 1);
                                c.Fa = !0;
                                g.Oa(c, -1);
                            }), jQuery(g.va).bind("error", function() {
                                g.Oa(c, -1);
                                c.oc();
                            })) : c.oc(), "BookView" == c.ba && jQuery(g.va).attr("src", g.za(c.pages.la + 1)), "TwoPage" == c.ba && jQuery(g.va).attr("src", g.za(c.pages.la + 2)), 1 < c.pages.la && jQuery(c.ma + "_2").removeClass("flowpaper_hidden"), jQuery(c.ma + "_2").removeClass("flowpaper_load_on_demand")), null != e && e());
                        }
                    }
                }
            },
            Dc: function(c) {
                if ("Portrait" != c.ba || Math.round(c.cg / c.bg * 100) == Math.round(c.dimensions.width / c.dimensions.height * 100) && !this.Jb || eb.browser.msie && 9 > eb.browser.version) {
                    if (c.ba == this.Pa(c)) {
                        this.xb(c).Dc(this, c);
                    } else {
                        if ("TwoPage" == c.ba || "BookView" == c.ba) {
                            if (0 == c.pageNumber) {
                                var d = "BookView" == c.ba ? 0 != c.pages.la ? c.pages.la : c.pages.la + 1 : c.pages.la + 1;
                                c.mh != d && (eb.browser.msie || eb.browser.safari && 5 > eb.browser.Hb ? jQuery(c.Ka).attr("src", this.za(d)) : jQuery(c.Ka).css("background-image", "url('" + this.za(d) + "')"), jQuery(c.ma + "_1").removeClass("flowpaper_hidden"), c.mh = d);
                                jQuery(c.Ka).removeClass("flowpaper_hidden");
                            }
                            1 == c.pageNumber && (d = "BookView" == c.ba ? c.pages.la + 1 : c.pages.la + 2, c.mh != d && (eb.browser.msie || eb.browser.safari && 5 > eb.browser.Hb ? jQuery(c.Ka).attr("src", this.za(d)) : jQuery(c.Ka).css("background-image", "url('" + this.za(d) + "')"), c.mh = d, "TwoPage" == c.ba && jQuery(c.ma + "_2").removeClass("flowpaper_hidden")), jQuery(c.Ka).removeClass("flowpaper_hidden"));
                        } else {
                            "SinglePage" == c.ba ? jQuery(c.Ka).attr("src", this.za(this.Ma(c) + 1)) : this.Jb ? (jQuery(c.Ka).attr("data", this.za(c.pageNumber + 1, null, !0)), jQuery(c.ma).removeClass("flowpaper_load_on_demand")) : jQuery(c.Ka).attr("src", this.za(c.pageNumber + 1), "ThumbView" == c.ba ? 200 : null), jQuery("#" + c.tc).hide();
                        }
                        c.Fa || jQuery("#" + this.ja).trigger("onPageLoaded", c.pageNumber + 1);
                        c.Fa = !0;
                    }
                } else {
                    this.Jb ? (jQuery(c.Ka).attr("data", this.za(c.pageNumber + 1, null, !0)), jQuery(c.ma).removeClass("flowpaper_load_on_demand"), jQuery(c.Ka).css("width", jQuery(c.Ka).css("width"))) : (jQuery(c.Ka).css("background-image", "url('" + this.za(c.pageNumber + 1) + "')"), jQuery(c.Ka).attr("src", this.wa)), jQuery("#" + c.tc).hide(), c.Fa || jQuery("#" + this.ja).trigger("onPageLoaded", c.pageNumber + 1), c.Fa = !0;
                }
                this.Oa(c, -1);
                this.qf || (this.qf = !0, c.aa.kh());
            },
            kl: function(c) {
                "TwoPage" == c.ba || "BookView" == c.ba ? (0 == c.pageNumber && jQuery(c.ta).css("background-image", "url(" + this.wa + ")"), 1 == c.pageNumber && jQuery(c.ta).css("background-image", "url(" + this.wa + ")")) : jQuery(c.ta).css("background-image", "url(" + this.wa + ")");
            },
            unload: function(c) {
                jQuery(c.ma).addClass("flowpaper_load_on_demand");
                var d = null;
                if ("Portrait" == c.ba || "ThumbView" == c.ba || "SinglePage" == c.ba) {
                    d = jQuery(c.Ka);
                }
                if ("TwoPage" == c.ba || "BookView" == c.ba) {
                    d = jQuery(c.Ka), jQuery(c.Ka).addClass("flowpaper_hidden");
                }
                c.ba == this.Pa(c) && this.xb(c).unload(this, c);
                null != d && 0 < d.length && (d.attr("alt", d.attr("src")), d.attr("src", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"));
                c.qc = !1;
                c.mh = -1;
                jQuery(".flowpaper_pageword_" + this.ja + "_page_" + c.pageNumber + ":not(.flowpaper_selected_searchmatch, .flowpaper_annotation_" + this.ja + ")").remove();
                c.cj && c.cj();
                jQuery(".flowpaper_annotation_" + this.ja + "_page_" + c.pageNumber).remove();
                c.qg && c.qg();
            },
            getNumPages: function() {
                return this.oa.length;
            },
            lc: function(c, d, e, g) {
                this.Wa.lc(c, d, e, g);
            },
            xc: function(c, d, e) {
                this.Wa.xc(c, d, e);
            },
            Ce: function(c, d, e, g) {
                this.Wa.Ce(c, d, e, g);
            },
            La: function(c, d, e) {
                this.Wa.La(c, e);
            },
            Zg: function(c, d) {
                if (this.tb) {
                    if (c.scale < c.Xf()) {
                        c.Dl = d, c.El = !1;
                    } else {
                        !d && c.Dl && (d = c.Dl);
                        var e = 0.25 * Math.round(c.zi()),
                            g = 0.25 * Math.round(c.yi());
                        jQuery(".flowpaper_flipview_canvas_highres_" + c.pageNumber).remove();
                        null == d && (d = c.ma);
                        var h = eb.platform.Kd || eb.platform.android ? "flowpaper_flipview_canvas_highres" : c.pa + "_canvas_highres";
                        jQuery(d).append(String.format("<div id='" + c.pa + "_canvas_highres_l1t1' class='{4}' style='z-index:11;position:relative;float:left;background-repeat:no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;clear:both;'></div>", 0, 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_l2t1' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", e + 0 + 0, 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_r1t1' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", 2 * e + 0, 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_r2t1' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", 3 * e + 0, 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_l1t2' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;clear:both;'></div>", 0, g + 0 + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_l2t2' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", e + 0 + 0, g + 0 + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_r1t2' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", 2 * e + 0, g + 0 + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_r2t2' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", 3 * e + 0, g + 0 + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_l1b1' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;clear:both;'></div>", 0, 2 * g + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_l2b1' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", e + 0 + 0, 2 * g + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_r1b1' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", 2 * e + 0, 2 * g + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_r2b1' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", 3 * e + 0, 2 * g + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_l1b2' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;clear:both;'></div>", 0, 3 * g + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_l2b2' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", e + 0 + 0, 3 * g + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_r1b2' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", 2 * e + 0, 3 * g + 0, e, g, h) + String.format("<div id='" + c.pa + "_canvas_highres_r2b2' class='{4}' style='z-index:11;position:relative;float:left;background-repeat-no-repeat;background-size:100% 100%;width:{2}px;height:{3}px;'></div>", 3 * e + 0, 3 * g + 0, e, g, h) + "");
                        c.El = !0;
                    }
                }
            },
            Xc: function(c) {
                if (!(c.scale < c.Xf())) {
                    !c.El && this.tb && this.Zg(c);
                    if (this.tb) {
                        var d = document.getElementById(c.pa + "_canvas_highres_l1t1"),
                            e = document.getElementById(c.pa + "_canvas_highres_l2t1"),
                            g = document.getElementById(c.pa + "_canvas_highres_l1t2"),
                            h = document.getElementById(c.pa + "_canvas_highres_l2t2"),
                            f = document.getElementById(c.pa + "_canvas_highres_r1t1"),
                            k = document.getElementById(c.pa + "_canvas_highres_r2t1"),
                            m = document.getElementById(c.pa + "_canvas_highres_r1t2"),
                            n = document.getElementById(c.pa + "_canvas_highres_r2t2"),
                            u = document.getElementById(c.pa + "_canvas_highres_l1b1"),
                            v = document.getElementById(c.pa + "_canvas_highres_l2b1"),
                            p = document.getElementById(c.pa + "_canvas_highres_l1b2"),
                            q = document.getElementById(c.pa + "_canvas_highres_l2b2"),
                            r = document.getElementById(c.pa + "_canvas_highres_r1b1"),
                            t = document.getElementById(c.pa + "_canvas_highres_r2b1"),
                            y = document.getElementById(c.pa + "_canvas_highres_r1b2"),
                            E = document.getElementById(c.pa + "_canvas_highres_r2b2");
                        if (1 == c.pageNumber && 1 == c.pages.la || c.pageNumber == c.pages.la - 1 || c.pageNumber == c.pages.la - 2) {
                            var x = c.ba == this.Pa(c) ? c.pages.da : null,
                                A = c.ba == this.Pa(c) ? c.pageNumber + 1 : c.pages.la + 1;
                            jQuery(d).visible(!0, x) && "none" === jQuery(d).css("background-image") && jQuery(d).css("background-image", "url('" + this.Mb(A, "l1t1") + "')");
                            jQuery(e).visible(!0, x) && "none" === jQuery(e).css("background-image") && jQuery(e).css("background-image", "url('" + this.Mb(A, "l2t1") + "')");
                            jQuery(g).visible(!0, x) && "none" === jQuery(g).css("background-image") && jQuery(g).css("background-image", "url('" + this.Mb(A, "l1t2") + "')");
                            jQuery(h).visible(!0, x) && "none" === jQuery(h).css("background-image") && jQuery(h).css("background-image", "url('" + this.Mb(A, "l2t2") + "')");
                            jQuery(f).visible(!0, x) && "none" === jQuery(f).css("background-image") && jQuery(f).css("background-image", "url('" + this.Mb(A, "r1t1") + "')");
                            jQuery(k).visible(!0, x) && "none" === jQuery(k).css("background-image") && jQuery(k).css("background-image", "url('" + this.Mb(A, "r2t1") + "')");
                            jQuery(m).visible(!0, x) && "none" === jQuery(m).css("background-image") && jQuery(m).css("background-image", "url('" + this.Mb(A, "r1t2") + "')");
                            jQuery(n).visible(!0, x) && "none" === jQuery(n).css("background-image") && jQuery(n).css("background-image", "url('" + this.Mb(A, "r2t2") + "')");
                            jQuery(u).visible(!0, x) && "none" === jQuery(u).css("background-image") && jQuery(u).css("background-image", "url('" + this.Mb(A, "l1b1") + "')");
                            jQuery(v).visible(!0, x) && "none" === jQuery(v).css("background-image") && jQuery(v).css("background-image", "url('" + this.Mb(A, "l2b1") + "')");
                            jQuery(p).visible(!0, x) && "none" === jQuery(p).css("background-image") && jQuery(p).css("background-image", "url('" + this.Mb(A, "l1b2") + "')");
                            jQuery(q).visible(!0, x) && "none" === jQuery(q).css("background-image") && jQuery(q).css("background-image", "url('" + this.Mb(A, "l2b2") + "')");
                            jQuery(r).visible(!0, x) && "none" === jQuery(r).css("background-image") && jQuery(r).css("background-image", "url('" + this.Mb(A, "r1b1") + "')");
                            jQuery(t).visible(!0, x) && "none" === jQuery(t).css("background-image") && jQuery(t).css("background-image", "url('" + this.Mb(A, "r2b1") + "')");
                            jQuery(y).visible(!0, x) && "none" === jQuery(y).css("background-image") && jQuery(y).css("background-image", "url('" + this.Mb(A, "r1b2") + "')");
                            jQuery(E).visible(!0, x) && "none" === jQuery(E).css("background-image") && jQuery(E).css("background-image", "url('" + this.Mb(A, "r2b2") + "')");
                        }
                    }
                    c.hl = !0;
                }
            },
            zc: function(c) {
                if (this.tb) {
                    var d = eb.platform.Kd || eb.platform.android ? "flowpaper_flipview_canvas_highres" : c.pa + "_canvas_highres";
                    c.hl && 0 < jQuery("." + d).length && (jQuery("." + d).css("background-image", ""), c.hl = !1);
                }
            }
        };
        return f;
    }(),
    CanvasPageRenderer = window.CanvasPageRenderer = function() {
        function f(c, d, e, g) {
            this.ja = c;
            this.file = d;
            this.jsDirectory = e;
            this.initialized = !1;
            this.JSONPageDataFormat = this.Qa = this.dimensions = null;
            this.pageThumbImagePattern = g.pageThumbImagePattern;
            this.pageImagePattern = g.pageImagePattern;
            this.config = g;
            this.Kg = this.ja + "_dummyPageCanvas_[pageNumber]";
            this.hi = "#" + this.Kg;
            this.Lg = this.ja + "dummyPageCanvas2_[pageNumber]";
            this.ii = "#" + this.Lg;
            this.sb = [];
            this.context = this.ta = null;
            this.Ua = [];
            this.rh = [];
            this.jd = "data:image/gif;base64,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%3D%3D";
            this.vb = this.qf = !1;
            this.wa = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            this.gh = 1;
            this.mb = [];
            this.hh = {};
            this.JSONPageDataFormat = null;
            this.ce = !0;
            this.Sa = null != g.compressedJSONFormat ? g.compressedJSONFormat : !0;
            this.Yh = [];
        }
        f.prototype = {
            lf: function() {
                return "CanvasPageRenderer";
            },
            Pa: function(c) {
                return c.aa ? c.aa.ca ? c.aa.ca.na : "" : !1;
            },
            xb: function(c) {
                return c.aa.ca.Om;
            },
            dispose: function() {
                jQuery(this.Wa).unbind();
                this.Wa.dispose();
                delete this.gd;
                this.gd = null;
                delete this.dimensions;
                this.dimensions = null;
                delete this.Wa;
                this.Wa = null;
                delete this.Ua;
                this.Ua = null;
                delete this.rh;
                this.rh = null;
            },
            initialize: function(c, d) {
                var e = this;
                e.gd = c;
                e.rd = eb.platform.rd;
                1 < e.rd && eb.platform.touchonlydevice && (e.rd = 1);
                e.oo = ("undefined" != e.jsDirectory && null != e.jsDirectory ? e.jsDirectory : "js/") + "pdf.min.js";
                e.Sa ? e.JSONPageDataFormat = {
                    Qe: "width",
                    Pe: "height",
                    we: "text",
                    Qb: "d",
                    ng: "f",
                    xd: "l",
                    yd: "t",
                    zd: "w",
                    wd: "h"
                } : e.JSONPageDataFormat = {
                    Qe: e.config.JSONPageDataFormat.pageWidth,
                    Pe: e.config.JSONPageDataFormat.pageHeight,
                    we: e.config.JSONPageDataFormat.textCollection,
                    Qb: e.config.JSONPageDataFormat.textFragment,
                    ng: e.config.JSONPageDataFormat.textFont,
                    xd: e.config.JSONPageDataFormat.textLeft,
                    yd: e.config.JSONPageDataFormat.textTop,
                    zd: e.config.JSONPageDataFormat.textWidth,
                    wd: e.config.JSONPageDataFormat.textHeight
                };
                e.Ha = e.file.indexOf && 0 <= e.file.indexOf("[*,") && e.config && null != e.config.jsonfile && !d.tk;
                e.Ha && (e.Zo = e.file.substr(e.file.indexOf("[*,"), e.file.indexOf("]") - e.file.indexOf("[*,")), e.lk = e.lk = !1);
                PDFJS.workerSrc = ("undefined" != e.jsDirectory && null != e.jsDirectory ? e.jsDirectory : "js/") + "pdf.worker.min.js";
                jQuery.getScript(e.oo, function() {
                    if (e.lk) {
                        var g = new XMLHttpRequest;
                        g.open("HEAD", e.ci(1), !1);
                        g.overrideMimeType("application/pdf");
                        g.onreadystatechange = function() {
                            if (200 == g.status) {
                                var c = g.getAllResponseHeaders(),
                                    d = {};
                                if (c) {
                                    for (var c = c.split("\r\n"), h = 0; h < c.length; h++) {
                                        var f = c[h],
                                            l = f.indexOf(": ");
                                        0 < l && (d[f.substring(0, l)] = f.substring(l + 2));
                                    }
                                }
                                e.Oj = "bytes" === d["Accept-Ranges"];
                                e.Um = "identity" === d["Content-Encoding"] || null === d["Content-Encoding"] || !d["Content-Encoding"];
                                e.Oj && e.Um && !eb.platform.ios && !eb.browser.safari && (e.file = e.file.substr(0, e.file.indexOf(e.Zo) - 1) + ".pdf", e.Ha = !1);
                            }
                            g.abort();
                        };
                        try {
                            g.send(null);
                        } catch (f) {}
                    }
                    e.Wa = new fa(e.ja, e.Ha, e.JSONPageDataFormat, !0);
                    window["wordPageList_" + e.ja] = e.Wa.Ua;
                    jQuery("#" + e.ja).trigger("onDocumentLoading");
                    FLOWPAPER.RANGE_CHUNK_SIZE && (PDFJS.RANGE_CHUNK_SIZE = FLOWPAPER.RANGE_CHUNK_SIZE);
                    PDFJS.disableWorker = e.Ha || eb.browser.Ti || eb.browser.msie;
                    PDFJS.disableRange = e.Ha;
                    PDFJS.disableAutoFetch = e.Ha || !1;
                    PDFJS.disableStream = e.Ha || !1;
                    PDFJS.pushTextGeometries = !e.Ha;
                    PDFJS.verbosity = PDFJS.VERBOSITY_LEVELS.errors;
                    PDFJS.enableStats = !1;
                    PDFJS.Iq = !0;
                    PDFJS.Jq = !0;
                    if (e.Ha) {
                        e.Ha && e.config && null != e.config.jsonfile && (e.Ha = !0, e.Ld = e.config.jsonfile, e.xr = new Promise(function() {}), jQuery.ajax({
                            url: e.af(10),
                            dataType: e.config.JSONDataType,
                            success: function(c) {
                                c.e && (c = CryptoJS.Ae.decrypt(c.e, CryptoJS.nc.ze.parse(eb.Sg ? P() : eb.Xd.innerHTML)), c = jQuery.parseJSON(c.toString(CryptoJS.nc.Kf)), e.Ve = !0);
                                jQuery(e).trigger("loadingProgress", {
                                    ja: e.ja,
                                    progress: 0.1
                                });
                                if (0 < c.length) {
                                    e.oa = Array(c[0].pages);
                                    for (var d = 0; d < c.length; d++) {
                                        e.oa[d] = c[d], e.oa[d].loaded = !0, e.ph(d);
                                    }
                                    0 < e.oa.length && (e.nb = e.oa[0].twofold, e.nb && (e.rd = 1));
                                    for (d = 0; d < e.oa.length; d++) {
                                        null == e.oa[d] && (e.oa[d] = [], e.oa[d].loaded = !1);
                                    }
                                    e.Wa.Df(e.oa);
                                }
                                e.He = 1;
                                e.Qa = Array(c[0].pages);
                                e.sb = Array(c[0].pages);
                                e.Ni(e.He, function() {
                                    jQuery(e).trigger("loadingProgress", {
                                        ja: e.ja,
                                        progress: 1
                                    });
                                    e.gd();
                                }, null, function(c) {
                                    c = 0.1 + c;
                                    1 < c && (c = 1);
                                    jQuery(e).trigger("loadingProgress", {
                                        ja: e.ja,
                                        progress: c
                                    });
                                });
                            },
                            error: function(g, h, f) {
                                h = null != g.responseText && 0 == g.responseText.indexOf("Error:") ? g.responseText.substr(6) : "";
                                this.url.indexOf("view.php") || this.url.indexOf("view.ashx") ? (console.log("Warning: Could not load JSON file. Switching to single file mode."), d.tk = !0, e.Ha = !1, e.initialize(c, d), e.pageThumbImagePattern = null) : O("Error loading JSON file (" + g.statusText + "," + f + "). Please check your configuration.", "onDocumentLoadedError", e.ja, h);
                            }
                        }));
                    } else {
                        e.Ld = e.config.jsonfile;
                        var h = new jQuery.Deferred;
                        if (e.Ld && 0 < e.Ld.length) {
                            var l = jQuery.ajax({
                                url: e.af(10),
                                dataType: e.config.JSONDataType,
                                success: function(c) {
                                    c.e && (c = CryptoJS.Ae.decrypt(c.e, CryptoJS.nc.ze.parse(eb.Sg ? P() : eb.Xd.innerHTML)), c = jQuery.parseJSON(c.toString(CryptoJS.nc.Kf)), e.Ve = !0);
                                    if (0 < c.length) {
                                        e.oa = Array(c[0].pages);
                                        for (var d = 0; d < c.length; d++) {
                                            e.oa[d] = c[d], e.oa[d].loaded = !0, e.ph(d);
                                        }
                                        for (d = 0; d < e.oa.length; d++) {
                                            null == e.oa[d] && (e.oa[d] = [], e.oa[d].loaded = !1);
                                        }
                                        e.Wa.Df(e.oa);
                                        0 < e.oa.length && (e.nb = e.oa[0].twofold, e.nb && (e.rd = 1));
                                    }
                                }
                            });
                            l.fail(function() {
                                h.resolve();
                            });
                            l.then(function() {
                                h.resolve();
                            });
                        } else {
                            h.resolve();
                        }
                        h.then(function() {
                            var c = {},
                                g = e.file;
                            d && d.tk && g.match(/(page=\d)/ig) && (g = g.replace(/(page=\d)/ig, ""));
                            !e.file.indexOf || e.file instanceof Uint8Array || e.file.indexOf && 0 == e.file.indexOf("blob:") ? c = g : c.url = g;
                            e.il() && (c.password = e.config.signature + "e0737b87e9be157a2f73ae6ba1352a65");
                            var h = 0;
                            c.rangeChunkSize = FLOWPAPER.RANGE_CHUNK_SIZE;
                            c = PDFJS.getDocument(c);
                            c.onPassword = function(c, d) {
                                jQuery("#" + e.ja).trigger("onPasswordNeeded", c, d);
                            };
                            c.onProgress = function(c) {
                                h = c.loaded / c.total;
                                1 < h && (h = 1);
                                jQuery(e).trigger("loadingProgress", {
                                    ja: e.ja,
                                    progress: h
                                });
                            };
                            c.then(function(c) {
                                0.5 > h && jQuery(e).trigger("loadingProgress", {
                                    ja: e.ja,
                                    progress: 0.5
                                });
                                e.pdf = e.Qa = c;
                                e.Qa.getPageLabels().then(function(c) {
                                    jQuery(e).trigger("labelsLoaded", {
                                        Ok: c
                                    });
                                });
                                e.initialized = !0;
                                e.dimensions = null;
                                e.sb = Array(e.nb ? e.oa.length : e.Qa.numPages);
                                e.dimensions = [];
                                e.Qa.getDestinations().then(function(c) {
                                    e.destinations = c;
                                });
                                var g = d && d.StartAtPage ? parseInt(d.StartAtPage) : 1;
                                e.Qa.getPage(g).then(function(c) {
                                    c = c.getViewport(1);
                                    var d = e.Qa.numPages;
                                    !e.Ha && e.nb && (d = e.oa.length);
                                    for (i = 1; i <= d; i++) {
                                        e.dimensions[i - 1] = [], e.dimensions[i - 1].page = i - 1, e.dimensions[i - 1].width = c.width, e.dimensions[i - 1].height = c.height, e.dimensions[i - 1].Ca = c.width, e.dimensions[i - 1].Na = c.height;
                                    }
                                    e.ei = !0;
                                    jQuery(e).trigger("loadingProgress", {
                                        ja: e.ja,
                                        progress: 1
                                    });
                                    1 == g && 1 < d && window.zine ? e.Qa.getPage(2).then(function(c) {
                                        c = c.getViewport(1);
                                        e.nb = 2 * Math.round(e.dimensions[0].width) >= Math.round(c.width) - 1 && 2 * Math.round(e.dimensions[0].width) <= Math.round(c.width) + 1;
                                        if (e.nb) {
                                            e.oa = Array(d);
                                            for (var g = 0; g < e.oa.length; g++) {
                                                e.oa[g] = {}, e.oa[g].text = [], e.oa[g].pages = d, e.oa[g].nb = !0, e.oa[g].width = 0 == g ? e.dimensions[0].width : c.width, e.oa[g].height = 0 == g ? e.dimensions[0].height : c.height, e.ph(g);
                                            }
                                        }
                                        e.gd();
                                    }) : e.gd();
                                });
                                e.Fl(e.Qa);
                            }, function(c) {
                                O("Cannot load PDF file (" + c + ")", "onDocumentLoadedError", e.ja, "Cannot load PDF file (" + c + ")");
                                jQuery(e).trigger("loadingProgress", {
                                    ja: e.ja,
                                    progress: "Error"
                                });
                            }, function() {}, function(c) {
                                jQuery(e).trigger("loadingProgress", {
                                    ja: e.ja,
                                    progress: c.loaded / c.total
                                });
                            });
                        });
                    }
                }).fail(function() {});
                e.JSONPageDataFormat = {
                    Qe: "width",
                    Pe: "height",
                    we: "text",
                    Qb: "d",
                    ng: "f",
                    xd: "l",
                    yd: "t",
                    zd: "w",
                    wd: "h"
                };
            },
            Ni: function(c, d, e) {
                var g = this,
                    h = {};
                h.url = g.ci(c);
                g.il() && (h.password = g.config.signature + "e0737b87e9be157a2f73ae6ba1352a65");
                h.rangeChunkSize = FLOWPAPER.RANGE_CHUNK_SIZE;
                g.bs = PDFJS.getDocument(h).then(function(h) {
                    g.Qa[c - 1] = h;
                    g.initialized = !0;
                    g.dimensions || (g.dimensions = []);
                    g.Qa[c - 1].getDestinations().then(function(c) {
                        g.destinations = c;
                    });
                    g.Qa[c - 1].getPage(1).then(function(h) {
                        g.sb[c - 1] = h;
                        var f = h.getViewport(1);
                        for (i = 1; i <= g.Qa[c - 1].numPages; i++) {
                            var l = g.dimensions && g.dimensions[i - 1] ? g.dimensions[i - 1] : [];
                            g.dimensions[i - 1] = [];
                            g.dimensions[i - 1].loaded = !0;
                            g.dimensions[i - 1].page = i - 1;
                            g.dimensions[i - 1].width = f.width;
                            1 < c && g.nb && (c < g.Qa[c - 1].numPages || 0 != g.Qa[c - 1].numPages % 2) ? (g.dimensions[i - 1].width = g.dimensions[i - 1].width / 2, g.dimensions[i - 1].Ca = f.width / 2) : g.dimensions[i - 1].Ca = f.width;
                            l.width && g.dimensions[i - 1].width != l.width && e && (e.dimensions.Ca = f.width, e.dimensions.Na = f.height, e.Xa());
                            g.dimensions[i - 1].Na = f.height;
                            g.dimensions[i - 1].height = f.height;
                            g.dimensions[i - 1].Ca = f.width;
                            g.dimensions[i - 1].Na = f.height;
                            1 < c && g.nb && (c < g.Qa[c - 1].numPages || 0 != g.Qa[c - 1].numPages % 2) && (g.dimensions[i - 1].Ca = g.dimensions[i - 1].Ca / 2);
                            null != g.Ra[i - 1] && g.Ra.length > i && (g.dimensions[i - 1].Zc = g.Ra[i].Zc, g.dimensions[i - 1].Yc = g.Ra[i].Yc, g.dimensions[i - 1].ub = g.Ra[i].ub, g.dimensions[i - 1].Ad = g.Ra[i].Ad);
                            g.hh[c - 1 + " " + h.ref.gen + " R"] = c - 1;
                        }
                        g.ei = !0;
                        g.He = -1;
                        d && d();
                    });
                    g.He = -1;
                }, function(c) {
                    O("Cannot load PDF file (" + c + ")", "onDocumentLoadedError", g.ja);
                    jQuery(g).trigger("loadingProgress", {
                        ja: g.ja,
                        progress: "Error"
                    });
                    g.He = -1;
                });
            },
            af: function(c) {
                return this.Ld.replace("{page}", c);
            },
            mi: function(c) {
                var d = 1;
                if (1 < c) {
                    for (var e = 0; e < c; e++) {
                        (0 != e % 2 || 0 == e % 2 && 0 == c % 2 && e == c - 1) && d++;
                    }
                    return d;
                }
                return 1;
            },
            il: function() {
                return null != this.config.signature && 0 < this.config.signature.length;
            },
            ci: function(c) {
                this.config.PageIndexAdjustment && (c += this.config.PageIndexAdjustment);
                this.nb && 1 < c && (c = this.mi(c));
                if (0 <= this.file.indexOf("{page}")) {
                    return this.file.replace("{page}", c);
                }
                if (0 <= this.file.indexOf("[*,")) {
                    var d = this.file.substr(this.file.indexOf("[*,"), this.file.indexOf("]") - this.file.indexOf("[*,") + 1);
                    return this.file.replace(d, ca(c, parseInt(d.substr(d.indexOf(",") + 1, d.indexOf("]") - 2))));
                }
            },
            Wf: function(c) {
                return c + (10 - c % 10);
            },
            Rc: function(c, d, e, g, h) {
                var f = this;
                f.kd == f.Wf(c) ? (window.clearTimeout(h.Yn), h.Yn = setTimeout(function() {
                    h.dimensions.loaded || f.Rc(c, d, e, g, h);
                }, 100)) : (f.kd = f.Wf(c), jQuery.ajax({
                    url: f.af(f.kd),
                    dataType: f.config.JSONDataType,
                    async: d,
                    success: function(c) {
                        c.e && (c = CryptoJS.Ae.decrypt(c.e, CryptoJS.nc.ze.parse(eb.Sg ? P() : eb.Xd.innerHTML)), c = jQuery.parseJSON(c.toString(CryptoJS.nc.Kf)), f.Ve = !0);
                        if (0 < c.length) {
                            for (var d = 0; d < c.length; d++) {
                                var g = parseInt(c[d].number) - 1;
                                f.oa[g] = c[d];
                                f.oa[g].loaded = !0;
                                f.ao(g);
                                f.ph(g, h);
                            }
                            f.Wa.Df(f.oa);
                            jQuery(f).trigger("onTextDataUpdated");
                            null != e && e();
                        }
                        f.kd = null;
                    },
                    error: function(c) {
                        O("Error loading JSON file (" + c.statusText + "). Please check your configuration.", "onDocumentLoadedError", f.ja);
                        f.kd = null;
                    }
                }));
            },
            ph: function(c) {
                this.Ra || (this.Ra = []);
                this.Ra[c] || (this.Ra[c] = []);
                this.Ra[c].Zc = this.oa[c][this.JSONPageDataFormat.Qe];
                this.Ra[c].Yc = this.oa[c][this.JSONPageDataFormat.Pe];
                this.Ra[c].ub = this.Ra[c].Zc;
                this.Ra[c].Ad = this.Ra[c].Yc;
                c = this.Ra[c];
                for (var d = 0; d < this.getNumPages(); d++) {
                    null == this.Ra[d] && (this.Ra[d] = [], this.Ra[d].Zc = c.Zc, this.Ra[d].Yc = c.Yc, this.Ra[d].ub = c.ub, this.Ra[d].Ad = c.Ad);
                }
            },
            getDimensions: function() {
                var c = this;
                if (null == c.dimensions || c.ei || null != c.dimensions && 0 == c.dimensions.length) {
                    null == c.dimensions && (c.dimensions = []);
                    var d = c.Qa.numPages;
                    !c.Ha && c.nb && (d = c.oa.length);
                    if (c.Ha) {
                        for (var e = 0; e < c.getNumPages(); e++) {
                            null != c.dimensions[e] || null != c.dimensions[e] && !c.dimensions[e].loaded ? (null == c.mc && (c.mc = c.dimensions[e]), c.dimensions[e].ub || null == c.Ra[e] || (c.dimensions[e].ub = c.Ra[e].ub, c.dimensions[e].Ad = c.Ra[e].Ad)) : null != c.mc && (c.dimensions[e] = [], c.dimensions[e].page = e, c.dimensions[e].loaded = !1, c.dimensions[e].width = c.mc.width, c.dimensions[e].height = c.mc.height, c.dimensions[e].Ca = c.mc.Ca, c.dimensions[e].Na = c.mc.Na, null != c.Ra[e - 1] && (c.dimensions[e - 1].Zc = c.Ra[e].Zc, c.dimensions[e - 1].Yc = c.Ra[e].Yc, c.dimensions[e - 1].ub = c.Ra[e].ub, c.dimensions[e - 1].Ad = c.Ra[e].Ad), e == c.getNumPages() - 1 && (c.dimensions[e].Zc = c.Ra[e].Zc, c.dimensions[e].Yc = c.Ra[e].Yc, c.dimensions[e].ub = c.Ra[e].ub, c.dimensions[e].Ad = c.Ra[e].Ad), c.hh[e + " 0 R"] = e);
                        }
                    } else {
                        for (e = 1; e <= d; e++) {
                            var g = e;
                            c.nb && (g = c.mi(e));
                            c.Qa.getPage(g).then(function(d) {
                                var e = d.getViewport(1);
                                c.dimensions[d.pageIndex] = [];
                                c.dimensions[d.pageIndex].page = d.pageIndex;
                                c.dimensions[d.pageIndex].width = e.width;
                                c.dimensions[d.pageIndex].height = e.height;
                                c.dimensions[d.pageIndex].Ca = e.width;
                                c.dimensions[d.pageIndex].Na = e.height;
                                e = d.ref;
                                c.hh[e.num + " " + e.gen + " R"] = d.pageIndex;
                            });
                        }
                    }
                    c.ei = !1;
                }
                return c.dimensions;
            },
            ao: function(c) {
                if (this.dimensions[c]) {
                    this.dimensions[c].page = c;
                    this.dimensions[c].loaded = !0;
                    this.mb[c] = [];
                    this.mb[c] = "";
                    for (var d = 0, e; e = this.oa[c][this.JSONPageDataFormat.we][d++];) {
                        this.Sa ? !isNaN(e[0].toString()) && 0 <= Number(e[0].toString()) && !isNaN(e[1].toString()) && 0 <= Number(e[1].toString()) && !isNaN(e[2].toString()) && 0 <= Number(e[2].toString()) && !isNaN(e[3].toString()) && 0 <= Number(e[3].toString()) && (this.mb[c] += e[5]) : !isNaN(e[this.JSONPageDataFormat.xd].toString()) && 0 <= Number(e[this.JSONPageDataFormat.xd].toString()) && !isNaN(e[this.JSONPageDataFormat.yd].toString()) && 0 <= Number(e[this.JSONPageDataFormat.yd].toString()) && !isNaN(e[this.JSONPageDataFormat.zd].toString()) && 0 < Number(e[this.JSONPageDataFormat.zd].toString()) && !isNaN(e[this.JSONPageDataFormat.wd].toString()) && 0 < Number(e[this.JSONPageDataFormat.wd].toString()) && (this.mb[c] += e[this.JSONPageDataFormat.Qb]);
                    }
                    this.mb[c] = this.mb[c].toLowerCase();
                }
            },
            getNumPages: function() {
                return this.Ha ? this.oa.length : this.nb ? this.oa.length : this.Qa ? this.Qa.numPages : this.oa.length;
            },
            getPage: function(c) {
                this.Qa.getPage(c).then(function(c) {
                    return c;
                });
                return null;
            },
            Dc: function(c) {
                var d = this;
                "TwoPage" == c.ba || "BookView" == c.ba ? (0 == c.pageNumber && jQuery(c.ta).css("background-image", "url('" + d.za(c.pages.la + 1) + "')"), 1 == c.pageNumber && jQuery(c.ta).css("background-image", "url('" + d.za(c.pages.la + 2) + "')")) : "ThumbView" == c.ba ? jQuery(c.ta).css("background-image", "url('" + d.za(c.pageNumber + 1, 200) + "')") : "SinglePage" == c.ba ? jQuery(c.ta).css("background-image", "url('" + d.za(d.Ma(c) + 1) + "')") : jQuery(c.ta).css("background-image", "url('" + d.za(c.pageNumber + 1) + "')");
                c.va = new Image;
                jQuery(c.va).bind("load", function() {
                    var e = Math.round(c.va.width / c.va.height * 100),
                        g = Math.round(c.dimensions.width / c.dimensions.height * 100);
                    if ("SinglePage" == c.ba) {
                        var e = d.Ra[c.pages.la],
                            h = Math.round(e.Zc / e.Yc * 100),
                            g = Math.round(c.dimensions.Ca / c.dimensions.Na * 100);
                        h != g && (c.dimensions.Ca = e.Zc, c.dimensions.Na = e.Yc, c.Xa(), c.wj = -1, d.La(c, !0, null));
                    } else {
                        e != g && (c.dimensions.Ca = c.va.width, c.dimensions.Na = c.va.height, c.Xa(), c.wj = -1, d.La(c, !0, null));
                    }
                });
                jQuery(c.va).attr("src", d.za(c.pageNumber + 1));
            },
            kl: function(c) {
                "TwoPage" == c.ba || "BookView" == c.ba ? (0 == c.pageNumber && jQuery(c.ta).css("background-image", "url(" + this.wa + ")"), 1 == c.pageNumber && jQuery(c.ta).css("background-image", "url(" + this.wa + ")")) : jQuery(c.ta).css("background-image", "url(" + this.wa + ")");
            },
            Jd: function(c) {
                this.qb = c.qb = this.Ha && this.config.MixedMode;
                "Portrait" != c.ba && "SinglePage" != c.ba || jQuery(c.ma).append("<canvas id='" + this.Ja(1, c) + "' style='position:relative;left:0px;top:0px;width:100%;height:100%;display:none;background-repeat:no-repeat;background-size:" + ((eb.browser.mozilla || eb.browser.safari) && eb.platform.mac ? "100% 100%" : "cover") + ";background-color:#ffffff;' class='" + (this.config.DisableShadows ? "" : "flowpaper_border") + " flowpaper_interactivearea flowpaper_grab flowpaper_hidden flowpaper_rescale'></canvas><canvas id='" + this.Ja(2, c) + "' style='position:relative;left:0px;top:0px;width:100%;height:100%;display:block;background-repeat:no-repeat;background-size:" + ((eb.browser.mozilla || eb.browser.safari) && eb.platform.mac ? "100% 100%" : "cover") + ";background-color:#ffffff;' class='" + (this.config.DisableShadows ? "" : "flowpaper_border") + " flowpaper_interactivearea flowpaper_grab flowpaper_hidden flowpaper_rescale'></canvas>");
                c.ba == this.Pa(c) && this.xb(c).Jd(this, c);
                "ThumbView" == c.ba && jQuery(c.ma).append("<canvas id='" + this.Ja(1, c) + "' style='" + c.getDimensions() + ";background-repeat:no-repeat;background-size:" + ((eb.browser.mozilla || eb.browser.safari) && eb.platform.mac ? "100% 100%" : "cover") + ";background-color:#ffffff;' class='flowpaper_interactivearea flowpaper_grab flowpaper_hidden' ></canvas>");
                if ("TwoPage" == c.ba || "BookView" == c.ba) {
                    0 == c.pageNumber && (jQuery(c.ma + "_1").append("<img id='" + c.tc + "_1' src='" + this.jd + "' style='position:absolute;left:" + (c.Va() - 30) + "px;top:" + c.Za() / 2 + "px;' />"), jQuery(c.ma + "_1").append("<canvas id='" + this.Ja(1, c) + "' style='position:absolute;width:100%;height:100%;background-repeat:no-repeat;background-size:" + ((eb.browser.mozilla || eb.browser.safari) && eb.platform.mac ? "100% 100%" : "cover") + ";background-color:#ffffff;' class='flowpaper_interactivearea flowpaper_grab flowpaper_hidden'/></canvas>"), jQuery(c.ma + "_1").append("<div id='" + c.pa + "_1_textoverlay' style='position:relative;left:0px;top:0px;width:100%;height:100%;z-index:10'></div>")), 1 == c.pageNumber && (jQuery(c.ma + "_2").append("<img id='" + c.tc + "_2' src='" + this.jd + "' style='position:absolute;left:" + (c.Va() / 2 - 10) + "px;top:" + c.Za() / 2 + "px;' />"), jQuery(c.ma + "_2").append("<canvas id='" + this.Ja(2, c) + "' style='position:absolute;width:100%;height:100%;background-repeat:no-repeat;background-size:" + ((eb.browser.mozilla || eb.browser.safari) && eb.platform.mac ? "100% 100%" : "cover") + ";background-color:#ffffff;' class='flowpaper_interactivearea flowpaper_grab flowpaper_hidden'/></canvas>"), jQuery(c.ma + "_2").append("<div id='" + c.pa + "_2_textoverlay' style='position:absolute;left:0px;top:0px;width:100%;height:100%;z-index:10'></div>"));
                }
            },
            Ja: function(c, d) {
                var e = d.pageNumber;
                if (("TwoPage" == d.ba || "BookView" == d.ba) && 0 == d.pageNumber % 2) {
                    return this.ja + "_dummyCanvas1";
                }
                if (("TwoPage" == d.ba || "BookView" == d.ba) && 0 != d.pageNumber % 2) {
                    return this.ja + "_dummyCanvas2";
                }
                if (1 == c) {
                    return this.Kg.replace("[pageNumber]", e);
                }
                if (2 == c) {
                    return this.Lg.replace("[pageNumber]", e);
                }
            },
            zn: function(c, d) {
                if (("TwoPage" == d.ba || "BookView" == d.ba) && 0 == d.pageNumber % 2) {
                    return "#" + this.ja + "_dummyCanvas1";
                }
                if (("TwoPage" == d.ba || "BookView" == d.ba) && 0 != d.pageNumber % 2) {
                    return "#" + this.ja + "_dummyCanvas2";
                }
                if (1 == c) {
                    return this.hi.replace("[pageNumber]", d.pageNumber);
                }
                if (2 == c) {
                    return this.ii.replace("[pageNumber]", d.pageNumber);
                }
            },
            Pb: function(c, d, e) {
                var g = this;
                g.li = !0;
                if (c.ba != g.Pa(c) || g.xb(c).Vo(g, c, d, e)) {
                    if ("Portrait" != c.ba && "TwoPage" != c.ba && "BookView" != c.ba || null != c.context || c.qc || (c.vd(), c.qc = !0), 1 == g.Bo && 1 < c.scale && c.qb && g.Oa(c, -1), -1 < g.Ma(c) || g.Ha && null != g.Af) {
                        window.clearTimeout(c.gc), c.gc = setTimeout(function() {
                            window.requestAnim(function() {
                                g.Pb(c, d, e);
                            });
                        }, 50);
                    } else {
                        g.Qk = c;
                        g.Bo = c.scale;
                        if ("TwoPage" == c.ba || "BookView" == c.ba) {
                            if (0 == c.pageNumber) {
                                "BookView" == c.ba ? g.Oa(c, 0 == c.pages.la ? c.pages.la : c.pages.la - 1) : "TwoPage" == c.ba && g.Oa(c, c.pages.la), g.hk = c, c.oc();
                            } else {
                                if (1 == c.pageNumber) {
                                    "BookView" == c.ba ? g.Oa(c, c.pages.la) : "TwoPage" == c.ba && g.Oa(c, c.pages.la + 1), g.hk = c, jQuery(c.ma + "_2").removeClass("flowpaper_hidden"), jQuery(c.ma + "_2").removeClass("flowpaper_load_on_demand"), c.oc();
                                } else {
                                    return;
                                }
                            }
                        } else {
                            "SinglePage" == c.ba ? g.Oa(c, c.pages.la) : (g.Oa(c, c.pageNumber), g.hk = c);
                        }
                        g.pj(c);
                        if ((c.qb || g.Ha) && !c.dimensions.loaded) {
                            var h = c.pageNumber + 1;
                            "SinglePage" == c.ba && (h = g.Ma(c) + 1);
                            g.Rc(h, !0, function() {
                                c.dimensions.loaded = !1;
                                g.lc(c);
                            }, !0, c);
                        }
                        var h = !1,
                            f = c.Uc + "_textLayer";
                        jQuery("#" + f).remove();
                        if (0 == jQuery("#" + f).length && ("Portrait" == c.ba || "SinglePage" == c.ba || "TwoPage" == c.ba || "BookView" == c.ba || c.ba == g.Pa(c) && g.xb(c).Jp(g, c))) {
                            var h = !0,
                                k = c.Lc(),
                                f = "<div id='" + f + "' class='flowpaper_textLayer flowpaper_pageword_" + g.ja + "' style='width:" + c.Va() + "px;height:" + c.Za() + "px;backface-visibility:hidden;'></div>";
                            "Portrait" == c.ba || g.Pa(c) ? jQuery(c.Ia).append(f) : "TwoPage" != c.ba && "BookView" != c.ba || jQuery(c.Ia + "_" + (c.pageNumber % 2 + 1)).append(f);
                            if (90 == c.rotation || 270 == c.rotation || 180 == c.rotation) {
                                jQuery(c.Ub).css({
                                    "z-index": 11,
                                    "margin-left": k
                                }), jQuery(c.Ub).transition({
                                    rotate: c.rotation,
                                    translate: "-" + k + "px, 0px"
                                }, 0);
                            }
                        }
                        if (c.qb && c.scale <= g.eh(c) && !c.Qf) {
                            -1 < g.Ma(c) && window.clearTimeout(c.gc), jQuery(c.ma).removeClass("flowpaper_load_on_demand"), g.Ha && c.aa.initialized && !c.Nm ? g.Yh.push(function() {
                                var d = new XMLHttpRequest;
                                d.open("GET", g.ci(c.pageNumber + 1), !0);
                                d.overrideMimeType("text/plain; charset=x-user-defined");
                                d.addEventListener("load", function() {
                                    g.cd();
                                });
                                d.addEventListener("error", function() {
                                    g.cd();
                                });
                                d.send(null);
                                c.Nm = !0;
                            }) : g.Oj && null == g.sb[g.Ma(c)] && (k = g.Ma(c) + 1, g.Qa && g.Qa.getPage && g.Qa.getPage(k).then(function(d) {
                                g.sb[g.Ma(c)] = d;
                            })), c.ba == g.Pa(c) ? g.xb(c).Pb(g, c, d, e) : (g.Dc(c), g.de(c, e)), c.Fa = !0;
                        } else {
                            if (c.qb && c.scale > g.eh(c) && !c.Qf) {
                                c.ba != g.Pa(c) && g.Dc(c);
                            } else {
                                if (!c.qb && c.hd && c.ba == g.Pa(c) && 1 == c.scale && !g.Hg) {
                                    if (!c.$c && 100 != c.ta.width) {
                                        c.$c = c.ta.toDataURL(), k = jQuery("#" + g.Ja(1, c)), k.css("background-image").length < c.$c.length + 5 && k.css("background-image", "url(" + c.$c + ")"), k[0].width = 100;
                                    } else {
                                        if (c.$c && !g.Ha && "none" != jQuery("#" + g.Ja(1, c)).css("background-image")) {
                                            g.Oa(c, -1);
                                            c.Fa = !0;
                                            return;
                                        }
                                    }
                                    g.$k(c);
                                }
                            }
                            null != g.sb[g.Ma(c)] || g.Ha || (k = g.Ma(c) + 1, g.nb && (k = g.mi(k)), g.Qa && g.Qa.getPage && g.Qa.getPage(k).then(function(h) {
                                g.sb[g.Ma(c)] = h;
                                window.clearTimeout(c.gc);
                                g.Oa(c, -1);
                                g.Pb(c, d, e);
                            }));
                            if (c.ta) {
                                if (100 == c.ta.width || 1 != c.scale || c.ba != g.Pa(c) || c.ol) {
                                    if (k = !0, null == g.sb[g.Ma(c)] && g.Ha && (c.ba == g.Pa(c) && (k = g.xb(c).Uo(g, c)), null == g.Qa[g.Ma(c)] && -1 == g.He && k && null == g.Af && (g.He = g.Ma(c) + 1, g.Ni(g.He, function() {
                                            window.clearTimeout(c.gc);
                                            g.Oa(c, -1);
                                            g.Pb(c, d, e);
                                        }, c))), null != g.sb[g.Ma(c)] || !k) {
                                        if (c.ba == g.Pa(c) ? g.xb(c).Pb(g, c, d, e) : (c.ta.width = c.Va(), c.ta.height = c.Za()), g.nb && 0 < c.Eb.indexOf("cropCanvas") && (c.ta.width = 2 * c.ta.width), null != g.sb[g.Ma(c)] || !k) {
                                            if (g.li) {
                                                k = c.ta.height / g.getDimensions()[c.pageNumber].height;
                                                c.ba != g.Pa(c) && (k *= g.rd);
                                                g.Ep = k;
                                                1.5 > k && (k = 1.5);
                                                g.zr = k;
                                                var m = g.sb[g.Ma(c)].getViewport(k);
                                                g.nb || (c.ta.width = m.width, c.ta.height = m.height);
                                                var n = c.yo = {
                                                    canvasContext: c.context,
                                                    viewport: m,
                                                    pageNumber: c.pageNumber,
                                                    uh: h && !g.Ha ? new ga : null
                                                };
                                                g.sb[g.Ma(c)].objs.geometryTextList = [];
                                                window.requestAnim(function() {
                                                    c.ta.style.display = "none";
                                                    c.ta.redraw = c.ta.offsetHeight;
                                                    c.ta.style.display = "";
                                                    g.Af = g.sb[g.Ma(c)].render(n);
                                                    g.Af.onContinue = function(c) {
                                                        c();
                                                    };
                                                    g.Af.promise.then(function() {
                                                        g.Af = null;
                                                        if (null != g.sb[g.Ma(c)]) {
                                                            if (g.Ha || c.qb && c.scale <= g.eh(c) || !c.ta) {
                                                                g.Ha || g.zl(g.sb[g.Ma(c)], c, m, g.Ha), g.de(c, e);
                                                            } else {
                                                                var d = c.ta.height / g.getDimensions()[c.pageNumber].height,
                                                                    h = g.sb[g.Ma(c)].objs.geometryTextList;
                                                                if (h) {
                                                                    for (var f = 0; f < h.length; f++) {
                                                                        h[f].Lo != d && (h[f].h = h[f].metrics.height / d, h[f].l = h[f].metrics.left / d, h[f].t = h[f].metrics.top / d, h[f].w = h[f].textMetrics.geometryWidth / d, h[f].d = h[f].unicode, h[f].f = h[f].fontFamily, h[f].Lo = d);
                                                                    }
                                                                    "SinglePage" == c.ba || "TwoPage" == c.ba || "BookView" == c.ba ? g.Wa.vl(h, g.Ma(c), g.getNumPages()) : g.Wa.vl(h, c.pageNumber, g.getNumPages());
                                                                }
                                                                g.zl(g.sb[g.Ma(c)], c, m, g.Ha);
                                                                g.de(c, e);
                                                                g.La(c, !0, e);
                                                            }
                                                        } else {
                                                            g.de(c, e), K(c.pageNumber + "  is missing its pdf page (" + g.Ma(c) + ")");
                                                        }
                                                    }, function(c) {
                                                        O(c.toString(), "onDocumentLoadedError", g.ja);
                                                        g.Af = null;
                                                    });
                                                }, 50);
                                            } else {
                                                g.Oa(c, -1);
                                            }
                                            jQuery(c.ma).removeClass("flowpaper_load_on_demand");
                                        }
                                    }
                                } else {
                                    jQuery("#" + g.Ja(1, c)).mg(), jQuery("#" + g.Ja(2, c)).Vg(), 1 == c.scale && eb.browser.safari ? (jQuery("#" + g.Ja(1, c)).css("-webkit-backface-visibility", "hidden"), jQuery("#" + g.Ja(2, c)).css("-webkit-backface-visibility", "hidden"), jQuery("#" + c.pa + "_textoverlay").css("-webkit-backface-visibility", "hidden")) : eb.browser.safari && (jQuery("#" + g.Ja(1, c)).css("-webkit-backface-visibility", "visible"), jQuery("#" + g.Ja(2, c)).css("-webkit-backface-visibility", "visible"), jQuery("#" + c.pa + "_textoverlay").css("-webkit-backface-visibility", "visible")), g.Oa(c, -1), c.Fa || jQuery("#" + g.ja).trigger("onPageLoaded", c.pageNumber + 1), c.Fa = !0, g.La(c, !0, e);
                                }
                            } else {
                                window.clearTimeout(c.gc);
                            }
                        }
                    }
                }
            },
            $k: function(c) {
                var d = null,
                    e = null;
                0 != c.pageNumber % 2 ? (d = c, e = c.aa.pages.pages[c.pageNumber - 1]) : (e = c, d = c.aa.pages.pages[c.pageNumber + 1]);
                if (c.ba == this.Pa(c) && !c.qb && c.hd && d && e && (!d.Sc || !e.Sc) && !this.Hg) {
                    var g = e.$c,
                        d = d.$c;
                    g && d && !c.Sc && e.hd(g, d);
                }
            },
            eh: function() {
                return 1.1;
            },
            Ma: function(c) {
                return this.Ha || PDFJS.disableWorker || null == c ? this.Ie : c.Ie;
            },
            Oa: function(c, d) {
                (!this.Ha || c && c.qb && 1 == c.scale) && c && (c.Ie = d);
                this.Ie = d;
            },
            pj: function(c) {
                "Portrait" == c.ba || "SinglePage" == c.ba ? jQuery(this.zn(1, c)).is(":visible") ? (c.Eb = this.Ja(2, c), c.tf = this.Ja(1, c)) : (c.Eb = this.Ja(1, c), c.tf = this.Ja(2, c)) : c.ba == this.Pa(c) ? this.xb(c).pj(this, c) : (c.Eb = this.Ja(1, c), c.tf = null);
                this.nb && 0 < c.pageNumber && 0 == c.pageNumber % 2 ? (c.ta = document.createElement("canvas"), c.ta.width = c.ta.height = 100, c.ta.id = c.Eb + "_cropCanvas", c.Eb = c.Eb + "_cropCanvas") : c.ta = document.getElementById(c.Eb);
                null != c.Mn && (c.Mn = document.getElementById(c.tf));
                c.ta && c.ta.getContext && (c.context = c.ta.getContext("2d"), c.context.Hf = c.context.mozImageSmoothingEnabled = c.context.imageSmoothingEnabled = !1);
            },
            Vm: function(c, d, e, g) {
                c = g.convertToViewportRectangle(d.rect);
                c = PDFJS.Util.normalizeRect(c);
                d = e.Lc();
                g = document.createElement("a");
                var h = e.ba == this.Pa(e) ? 1 : this.rd;
                g.style.position = "absolute";
                g.style.left = Math.floor(c[0]) / h + d + "px";
                g.style.top = Math.floor(c[1]) / h + "px";
                g.style.width = Math.ceil(c[2] - c[0]) / h + "px";
                g.style.height = Math.ceil(c[3] - c[1]) / h + "px";
                g.style["z-index"] = 20;
                g.style.cursor = "pointer";
                g.className = "pdfPageLink_" + e.pageNumber + " flowpaper_interactiveobject_" + this.ja;
                return g;
            },
            zl: function(c, d, e, g) {
                var h = this;
                if (1 == d.scale || d.ba != h.Pa(d)) {
                    jQuery(".pdfPageLink_" + d.pageNumber).remove(), c.getAnnotations().then(function(e) {
                        for (var f = 0; f < e.length; f++) {
                            var m = e[f];
                            switch (m.subtype) {
                                case "Link":
                                    var n = h.Vm("a", m, d, c.getViewport(h.Ep), c.view);
                                    n.style.position = "absolute";
                                    n.href = m.url || "";
                                    eb.platform.touchonlydevice || (jQuery(n).on("mouseover", function() {
                                        jQuery(this).stop(!0, !0);
                                        jQuery(this).css("background", d.aa.linkColor);
                                        jQuery(this).css({
                                            opacity: d.aa.ke
                                        });
                                    }), jQuery(n).on("mouseout", function() {
                                        jQuery(this).css("background", "");
                                        jQuery(this).css({
                                            opacity: 0
                                        });
                                    }));
                                    m.url || g ? null != n.href && "" != n.href && m.url && (jQuery(n).on("click", function() {
                                        jQuery(d.ia).trigger("onExternalLinkClicked", this.href);
                                    }), jQuery(d.Ia).append(n)) : (m = "string" === typeof m.dest ? h.destinations[m.dest][0] : null != m && null != m.dest ? m.dest[0] : null, m = m instanceof Object ? h.hh[m.num + " " + m.gen + " R"] : m + 1, jQuery(n).data("gotoPage", m + 1), jQuery(n).on("click", function() {
                                        d.aa.gotoPage(parseInt(jQuery(this).data("gotoPage")));
                                        return !1;
                                    }), jQuery(d.Ia).append(n));
                            }
                        }
                    });
                }
            },
            de: function(c, d) {
                this.La(c, !0, d);
                jQuery("#" + c.Eb).mg();
                this.Gk(c);
                "Portrait" != c.ba && "SinglePage" != c.ba || jQuery(c.Ob).remove();
                c.ba == this.Pa(c) && this.xb(c).de(this, c, d);
                if (c.Eb && 0 < c.Eb.indexOf("cropCanvas")) {
                    var e = c.ta;
                    c.Eb = c.Eb.substr(0, c.Eb.length - 11);
                    c.ta = jQuery("#" + c.Eb).get(0);
                    c.ta.width = e.width / 2;
                    c.ta.height = e.height;
                    c.ta.getContext("2d").drawImage(e, e.width / 2, 0, c.ta.width, c.ta.height, 0, 0, e.width / 2, e.height);
                    jQuery(c.ta).mg();
                }
                c.qb || !c.hd || c.Sc || !c.ta || this.Hg || (c.$c = c.ta.toDataURL(), this.$k(c));
                if (c.$c && 1 == c.scale && !this.Hg) {
                    var g = jQuery("#" + this.Ja(1, c));
                    requestAnim(function() {
                        g.css("background-image").length < c.$c.length + 5 && g.css("background-image", "url(" + c.$c + ")");
                        g[0].width = 100;
                    });
                }
                if ("TwoPage" == c.ba || "BookView" == c.ba) {
                    0 == c.pageNumber && (jQuery(c.Ka).removeClass("flowpaper_hidden"), jQuery(c.ma + "_1").removeClass("flowpaper_hidden")), 1 == c.pageNumber && jQuery(c.Ka).removeClass("flowpaper_hidden");
                }
                c.Fa || jQuery("#" + this.ja).trigger("onPageLoaded", c.pageNumber + 1);
                c.Fa = !0;
                c.ol = !1;
                c.nr = !1;
                this.qf || (this.qf = !0, c.aa.kh());
                null != d && d();
                this.cd();
            },
            cd: function() {
                0 < this.Yh.length && -1 == this.Ma() && this.Qk.Fa && !this.Qk.yb && this.Yh.shift()();
            },
            Gk: function(c) {
                "TwoPage" == c.ba || "BookView" == c.ba || c.ba == this.Pa(c) && !eb.browser.safari || jQuery("#" + c.tf).Vg();
                this.Oa(c, -1);
            },
            za: function(c, d) {
                this.Ve && (c = CryptoJS.Ae.encrypt(c.toString(), CryptoJS.nc.ze.parse(eb.Sg ? P() : eb.Xd.innerHTML)).toString());
                this.config.PageIndexAdjustment && (c += this.config.PageIndexAdjustment);
                if (!d) {
                    return this.pageSVGImagePattern ? this.pageSVGImagePattern.replace("{page}", c) : this.pageImagePattern.replace("{page}", c);
                }
                if (null != this.pageThumbImagePattern && 0 < this.pageThumbImagePattern.length) {
                    return this.pageThumbImagePattern.replace("{page}", c) + (0 < this.pageThumbImagePattern.indexOf("?") ? "&" : "?") + "resolution=" + d;
                }
            },
            unload: function(c) {
                jQuery(".flowpaper_pageword_" + this.ja + "_page_" + c.pageNumber + ":not(.flowpaper_selected_searchmatch, .flowpaper_annotation_" + this.ja + ")").remove();
                c.ba != this.Pa(c) && this.kl(c);
                c.qb && (jQuery(c.ta).css("background-image", "url(" + this.wa + ")"), c.va = null);
                null != c.context && null != c.ta && 100 != c.ta.width && (this.context = this.ta = c.yo = null, c.cj && c.cj(), jQuery(".flowpaper_annotation_" + this.ja + "_page_" + c.pageNumber).remove());
                this.Ha && (this.sb[c.pageNumber] && this.sb[c.pageNumber].cleanup(), this.Qa[c.pageNumber] = null, this.sb[c.pageNumber] = null);
                c.qg && c.qg();
            },
            Fl: function(c) {
                var d = this;
                d.Qa && d.Qa.getPage(d.gh).then(function(e) {
                    e.getTextContent().then(function(e) {
                        var h = "";
                        if (e) {
                            for (var f = 0; f < e.items.length; f++) {
                                h += e.items[f].str;
                            }
                        }
                        d.mb[d.gh - 1] = h.toLowerCase();
                        d.gh + 1 < d.getNumPages() + 1 && (d.gh++, d.Fl(c));
                    });
                });
            },
            lc: function(c, d, e, g) {
                this.Wa.lc(c, d, e, g);
            },
            xc: function(c, d, e) {
                this.Wa.xc(c, d, e);
            },
            Ce: function(c, d, e, g) {
                this.Wa.Ce(c, d, e, g);
            },
            La: function(c, d, e) {
                var g = null != this.oa && this.oa[c.pageNumber] && this.oa[c.pageNumber].text && 0 < this.oa[c.pageNumber].text.length && this.Ha;
                if (c.Fa || d || g) {
                    c.wj != c.scale && (jQuery(".flowpaper_pageword_" + this.ja + "_page_" + c.pageNumber).remove(), c.wj = c.scale), d = null != this.Ff ? this.Ff : e, this.Ff = null, this.Wa && this.Wa.La(c, d);
                } else {
                    if (null != e) {
                        if (null != this.Ff) {
                            var h = this.Ff;
                            this.Ff = function() {
                                h();
                                e();
                            };
                        } else {
                            this.Ff = e;
                        }
                    }
                }
            }
        };
        return f;
    }();

function ga() {
    this.beginLayout = function() {
        this.textDivs = [];
        this.rh = [];
    };
    this.endLayout = function() {};
}
var fa = window.TextOverlay = function() {
    function f(c, d, e, g) {
        this.ja = c;
        this.JSONPageDataFormat = e;
        this.oa = [];
        this.bb = null;
        this.Ua = [];
        this.Sa = this.Ip = d;
        this.vb = g;
        this.state = {};
        this.wa = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }
    f.prototype = {
        dispose: function() {
            delete this.ja;
            this.ja = null;
            delete this.oa;
            this.oa = null;
            delete this.JSONPageDataFormat;
            this.JSONPageDataFormat = null;
            delete this.bb;
            this.bb = null;
            delete this.Ua;
            this.Ua = null;
            delete this.state;
            this.state = null;
            delete this.wa;
            this.wa = null;
            delete this.vb;
            this.vb = null;
        },
        Ko: function() {
            this.state[this.Sa] || (this.state[this.Sa] = [], this.state[this.Sa].oa = this.oa, this.state[this.Sa].bb = this.bb, this.state[this.Sa].Ua = this.Ua, window["wordPageList_" + this.ja] = null);
            this.oa = [];
            this.bb = null;
            this.Ua = [];
            this.Sa = this.Ip;
        },
        Pa: function(c) {
            return c.aa.ca ? c.aa.ca.na : "";
        },
        xb: function(c) {
            return c.aa.ca.Bp;
        },
        Gm: function(c) {
            return c.aa.document.AutoDetectLinks;
        },
        Df: function(c) {
            this.oa = c;
            null == this.bb && (this.bb = Array(c.length));
            window["wordPageList_" + this.ja] = this.Ua;
        },
        vl: function(c, d, e) {
            null == this.bb && (this.bb = Array(e));
            this.oa[d] = [];
            this.oa[d].text = c;
            window["wordPageList_" + this.ja] = this.Ua;
        },
        lc: function(c, d, e, g) {
            var h = c.pageNumber,
                f = !1,
                k = !1;
            if (!this.bb) {
                if (c.qb && (this.Sa = !0), this.state[this.Sa]) {
                    if (this.oa = this.state[this.Sa].oa, this.bb = this.state[this.Sa].bb, this.Ua = this.state[this.Sa].Ua, window["wordPageList_" + this.ja] = this.Ua, !this.bb) {
                        return;
                    }
                } else {
                    return;
                }
            }
            if (window.annotations || !eb.touchdevice || g) {
                if (window.annotations || c.aa.Fc || g || c.aa.Lk || (f = !0), k = null != this.qd && null != this.qd[c.pageNumber], "ThumbView" != c.ba) {
                    if ("BookView" == c.ba && (0 == c.pageNumber && (h = 0 != c.pages.la ? c.pages.la - 1 : c.pages.la), 1 == c.pageNumber && (h = c.pages.la), 0 == c.pages.getTotalPages() % 2 && h == c.pages.getTotalPages() && (h = h - 1), 0 == c.pages.la % 2 && c.pages.la > c.pages.getTotalPages())) {
                        return;
                    }
                    "SinglePage" == c.ba && (h = c.pages.la);
                    if ("TwoPage" == c.ba && (0 == c.pageNumber && (h = c.pages.la), 1 == c.pageNumber && (h = c.pages.la + 1), 1 == c.pageNumber && h >= c.pages.getTotalPages() && 0 != c.pages.getTotalPages() % 2)) {
                        return;
                    }
                    d = c.ib || !d;
                    c.ba == this.Pa(c) && (isvisble = this.xb(c).Nc(this, c));
                    var m = jQuery(".flowpaper_pageword_" + this.ja + "_page_" + h + ":not(.flowpaper_annotation_" + this.ja + ")").length;
                    g = null != c.dimensions.ub ? c.dimensions.ub : c.dimensions.Ca;
                    g = this.vb ? c.Va() / g : 1;
                    if (d && 0 == m) {
                        var n = m = "",
                            u = 0;
                        if (null == this.bb[h] || !this.vb) {
                            if (null == this.oa[h]) {
                                return;
                            }
                            this.bb[h] = this.oa[h][this.JSONPageDataFormat.we];
                        }
                        if (null != this.bb[h]) {
                            c.qb && (this.Sa = !0);
                            var v = new WordPage(this.ja, h),
                                p = c.Lc(),
                                q = [],
                                r = c.ge(),
                                t = c.hf(),
                                y = !1,
                                E = -1,
                                x = -1,
                                A = 0,
                                z = -1,
                                F = -1,
                                I = !1;
                            this.Ua[h] = v;
                            c.ba == this.Pa(c) && (g = this.xb(c).vn(this, c, g));
                            c.Lr = g;
                            for (var J = 0; y = this.bb[h][J++];) {
                                var H = J - 1,
                                    w = this.Sa ? y[5] : y[this.JSONPageDataFormat.Qb],
                                    G = J,
                                    B = J < this.bb[h].length ? this.bb[h][J] : null,
                                    I = B ? this.Sa ? B[5] : B[this.JSONPageDataFormat.Qb] : "";
                                " " == I && (G = J + 1, I = (B = G < this.bb[h].length ? this.bb[h][G] : null) ? this.Sa ? B[5] : B[this.JSONPageDataFormat.Qb] : "");
                                var M = null,
                                    N = null;
                                if (null == w) {
                                    K("word not found in node");
                                    e && e();
                                    return;
                                }
                                0 == w.length && (w = " ");
                                var C = null;
                                if (-1 == w.indexOf("actionGoToR") && -1 == w.indexOf("actionGoTo") && -1 == w.indexOf("actionURI") && this.Gm(c)) {
                                    if (C = w.match(/\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?\u00ab\u00bb\u201c\u201d\u2018\u2019]))/ig)) {
                                        w = "actionURI(" + C[0] + "):" + C[0], this.bb[h][H][this.Sa ? 5 : this.JSONPageDataFormat.Qb] = w;
                                    }!C && -1 < w.indexOf("@") && (C = (w.trim() + I.trim()).match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi)) && (!w.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi) && B && (I = "actionURI(mailto:" + C[0] + "):" + C[0], this.bb[h][G][this.Sa ? 5 : this.JSONPageDataFormat.Qb] = I), w = "actionURI(mailto:" + C[0] + "):" + C[0], this.bb[h][H][this.Sa ? 5 : this.JSONPageDataFormat.Qb] = w);
                                }
                                if (0 <= w.indexOf("actionGoToR")) {
                                    M = w.substring(w.indexOf("actionGoToR") + 12, w.indexOf(",", w.indexOf("actionGoToR") + 13)), w = w.substring(w.indexOf(",") + 1);
                                } else {
                                    if (0 <= w.indexOf("actionGoTo")) {
                                        M = w.substring(w.indexOf("actionGoTo") + 11, w.indexOf(",", w.indexOf("actionGoTo") + 12)), w = w.substring(w.indexOf(",") + 1);
                                    } else {
                                        if (0 <= w.indexOf("actionURI") || C) {
                                            if (0 <= w.indexOf("actionURI(") && 0 < w.indexOf("):") ? (N = w.substring(w.indexOf("actionURI(") + 10, w.lastIndexOf("):")), w = w.substring(w.indexOf("):") + 2)) : (N = w.substring(w.indexOf("actionURI") + 10), w = w.substring(w.indexOf("actionURI") + 10)), -1 == N.indexOf("http") && -1 == N.indexOf("mailto") && 0 != N.indexOf("/")) {
                                                N = "http://" + N;
                                            } else {
                                                if (!C) {
                                                    for (H = J, G = this.Sa ? y[5] : y[this.JSONPageDataFormat.Qb], B = 1; 2 >= B; B++) {
                                                        for (H = J; H < this.bb[h].length && 0 <= this.bb[h][H].toString().indexOf("actionURI") && -1 == this.bb[h][H].toString().indexOf("actionURI(");) {
                                                            I = this.bb[h][H], C = this.Sa ? I[5] : I[this.JSONPageDataFormat.Qb], 1 == B ? 0 <= C.indexOf("actionURI") && 11 < C.length && -1 == C.indexOf("http://") && -1 == C.indexOf("https://") && -1 == C.indexOf("mailto") && (G += C.substring(C.indexOf("actionURI") + 10)) : this.Sa ? I[5] = G : I[this.JSONPageDataFormat.Qb], H++;
                                                        }
                                                        2 == B && -1 == G.indexOf("actionURI(") && (w = G, N = w.substring(w.indexOf("actionURI") + 10), w = w.substring(w.indexOf("actionURI") + 10));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                if (M || N || !f || k) {
                                    H = (this.Sa ? y[0] : y[this.JSONPageDataFormat.yd]) * g + 0;
                                    G = (this.Sa ? y[1] : y[this.JSONPageDataFormat.xd]) * g + 0;
                                    B = (this.Sa ? y[2] : y[this.JSONPageDataFormat.zd]) * g;
                                    C = (this.Sa ? y[3] : y[this.JSONPageDataFormat.wd]) * g;
                                    v.To(u, w);
                                    y = -1 != E && E != H;
                                    I = J == this.bb[h].length;
                                    G + B > r && (B = r - G);
                                    H + C > t && (C = t - H);
                                    q[u] = {};
                                    q[u].left = G;
                                    q[u].right = G + B;
                                    q[u].top = H;
                                    q[u].bottom = H + C;
                                    q[u].el = "#" + this.ja + "page_" + h + "_word_" + u;
                                    q[u].i = u;
                                    q[u].Yk = M;
                                    q[u].Vl = N;
                                    m += "<span id='" + this.ja + "page_" + h + "_word_" + u + "' class='flowpaper_pageword flowpaper_pageword_" + this.ja + "_page_" + h + " flowpaper_pageword_" + this.ja + "' style='left:" + G + "px;top:" + H + "px;width:" + B + "px;height:" + C + "px;margin-left:" + p + "px;" + (q[u].Yk || q[u].Vl ? "cursor:hand;" : "") + ";" + (eb.browser.msie ? "background-image:url(" + this.wa + ");color:transparent;" : "") + "'>" + (c.aa.Lk ? w : "") + "</span>";
                                    if (null != M || null != N) {
                                        var L = document.createElement("a");
                                        L.style.position = "absolute";
                                        L.style.left = Math.floor(G) + p + "px";
                                        L.style.top = Math.floor(H) + "px";
                                        L.style.width = Math.ceil(B) + "px";
                                        L.style.height = Math.ceil(C) + "px";
                                        L.style["margin-left"] = p;
                                        L.style.cursor = "pointer";
                                        L.setAttribute("data-href", null != N ? N : "");
                                        jQuery(L).css("z-index", "99");
                                        L.className = "pdfPageLink_" + c.pageNumber + " flowpaper_interactiveobject_" + this.ja + " flowpaper_pageword_" + this.ja + "_page_" + h + " gotoPage_" + M + " flowpaper_pageword_" + this.ja;
                                        eb.platform.touchonlydevice && (L.style.background = c.aa.linkColor, L.style.opacity = c.aa.ke);
                                        null != M && (jQuery(L).data("gotoPage", M), jQuery(L).on("click touchstart", function() {
                                            c.aa.gotoPage(parseInt(jQuery(this).data("gotoPage")));
                                            return !1;
                                        }));
                                        if (null != N) {
                                            jQuery(L).on("click touchstart", function(d) {
                                                jQuery(c.ia).trigger("onExternalLinkClicked", this.getAttribute("data-href"));
                                                d.stopImmediatePropagation();
                                                d.preventDefault();
                                                return !1;
                                            });
                                        }
                                        eb.platform.touchonlydevice || (jQuery(L).on("mouseover", function() {
                                            jQuery(this).stop(!0, !0);
                                            jQuery(this).css("background", c.aa.linkColor);
                                            jQuery(this).css({
                                                opacity: c.aa.ke
                                            });
                                        }), jQuery(L).on("mouseout", function() {
                                            jQuery(this).css("background", "");
                                            jQuery(this).css({
                                                opacity: 0
                                            });
                                        }));
                                        "TwoPage" == c.ba || "BookView" == c.ba ? (0 == c.pageNumber && jQuery(c.ma + "_1_textoverlay").append(L), 1 == c.pageNumber && jQuery(c.ma + "_2_textoverlay").append(L)) : jQuery(c.Ia).append(L);
                                    }
                                    eb.platform.touchdevice && "Portrait" == c.ba && (y || I ? (I && (A += B, n = n + "<div style='float:left;width:" + B + "px'>" + (" " == w ? "&nbsp;" : w) + "</div>"), n = "<div id='" + this.ja + "page_" + h + "_word_" + u + "_wordspan' class='flowpaper_pageword flowpaper_pageword_" + this.ja + "_page_" + h + " flowpaper_pageword_" + this.ja + "' style='color:transparent;left:" + z + "px;top:" + E + "px;width:" + A + "px;height:" + x + "px;margin-left:" + F + "px;font-size:" + x + "px" + (q[u].Yk || q[u].Vl ? "cursor:hand;" : "") + "'>" + n + "</div>", jQuery(c.Yi).append(n), E = H, x = C, A = B, z = G, F = p, n = "<div style='background-colorfloat:left;width:" + B + "px'>" + (" " == w ? "&nbsp;" : w) + "</div>") : (-1 == z && (z = G), -1 == F && (F = p), -1 == E && (E = H), -1 == x && (x = C), n = n + "<div style='float:left;width:" + B + "px'>" + (" " == w ? "&nbsp;" : w) + "</div>", A += B, x = C));
                                }
                                u++;
                            }
                            v.Po(q);
                            "Portrait" == c.ba && jQuery(c.Ub).append(m);
                            "SinglePage" == c.ba && jQuery(c.Ub).append(m);
                            c.ba == this.Pa(c) && this.xb(c).Fm(this, c, m);
                            if ("TwoPage" == c.ba || "BookView" == c.ba) {
                                0 == c.pageNumber && jQuery(c.ma + "_1_textoverlay").append(m), 1 == c.pageNumber && jQuery(c.ma + "_2_textoverlay").append(m);
                            }
                            d && jQuery(c).trigger("onAddedTextOverlay", c.pageNumber);
                            if (k) {
                                for (h = 0; h < this.qd[c.pageNumber].length; h++) {
                                    this.xm(c, this.qd[c.pageNumber][h].cp, this.qd[c.pageNumber][h].Cp);
                                }
                            }
                        }
                    }
                    null != e && e();
                }
            } else {
                e && e();
            }
        },
        xc: function(c, d, e) {
            var g = this;
            window.annotations || jQuery(c).unbind("onAddedTextOverlay");
            var h = "TwoPage" == c.ba || "BookView" == c.ba ? c.pages.la + c.pageNumber : c.pageNumber;
            "BookView" == c.ba && 0 < c.pages.la && 1 == c.pageNumber && (h = h - 2);
            "SinglePage" == c.ba && (h = c.pages.la);
            if ((c.ib || !e) && c.aa.gb - 1 == h) {
                if (jQuery(".flowpaper_selected").removeClass("flowpaper_selected"), jQuery(".flowpaper_selected_searchmatch").removeClass("flowpaper_selected_searchmatch"), jQuery(".flowpaper_selected_default").removeClass("flowpaper_selected_default"), jQuery(".flowpaper_tmpselection").remove(), !g.Ua[h] || null != g.Ua[h] && 0 == g.Ua[h].tg.length) {
                    jQuery(c).bind("onAddedTextOverlay", function() {
                        g.xc(c, d, e);
                    }), g.lc(c, e, null, !0);
                } else {
                    for (var f = g.Ua[h].tg, k = "", m = 0, n = 0, u = -1, v = -1, p = d.split(" "), q = 0; q < f.length; q++) {
                        var r = (f[q] + "").toLowerCase();
                        if (jQuery.trim(r) == d || jQuery.trim(k + r) == d) {
                            r = jQuery.trim(r);
                        }
                        if (0 == d.indexOf(k + r) && (k + r).length <= d.length && " " != k + r) {
                            if (k += r, -1 == u && (u = m, v = m + 1), d.length == r.length && (u = m), k.length == d.length) {
                                if (n++, c.aa.se == n) {
                                    if ("Portrait" == c.ba || "SinglePage" == c.ba) {
                                        eb.browser.rb.Bb ? jQuery("#pagesContainer_" + g.ja).scrollTo(jQuery(g.Ua[h].positions[u].el), 0, {
                                            axis: "xy",
                                            offset: -30
                                        }) : jQuery("#pagesContainer_" + g.ja).data("jsp").scrollToElement(jQuery(g.Ua[h].positions[u].el), !1);
                                    }
                                    for (var t = u; t < m + 1; t++) {
                                        c.ba == g.Pa(c) ? (r = jQuery(g.Ua[h].positions[t].el).clone(), g.xb(c).Xj(g, c, r, d)) : (jQuery(g.Ua[h].positions[t].el).addClass("flowpaper_selected"), jQuery(g.Ua[h].positions[t].el).addClass("flowpaper_selected_default"), jQuery(g.Ua[h].positions[t].el).addClass("flowpaper_selected_searchmatch"));
                                    }
                                } else {
                                    k = "", u = -1;
                                }
                            }
                        } else {
                            if (0 <= (k + r).indexOf(p[0])) {
                                -1 == u && (u = m, v = m + 1);
                                k += r;
                                if (1 < p.length) {
                                    for (r = 0; r < p.length - 1; r++) {
                                        0 < p[r].length && f.length > m + 1 + r && 0 <= (k + f[m + 1 + r]).toLowerCase().indexOf(p[r]) ? (k += f[m + 1 + r].toLowerCase(), v = m + 1 + r + 1) : (k = "", v = u = -1);
                                    }
                                } - 1 == k.indexOf(d) ? (k = "", v = u = -1) : n++;
                                if (c.aa.se == n && 0 < k.length) {
                                    for (var t = jQuery(g.Ua[h].positions[u].el), y = parseFloat(t.css("left").substring(0, t.css("left").length - 2)) - (c.ba == g.Pa(c) ? c.Lc() : 0), r = t.clone(), E = 0, x = 0, A = 0; u < v; u++) {
                                        E += parseFloat(jQuery(g.Ua[h].positions[u].el).css("width").substring(0, t.css("width").length - 2));
                                    }
                                    x = 1 - (k.length - d.length) / k.length;
                                    A = k.indexOf(d) / k.length;
                                    r.addClass("flowpaper_tmpselection");
                                    r.attr("id", r.attr("id") + "tmp");
                                    r.addClass("flowpaper_selected");
                                    r.addClass("flowpaper_selected_searchmatch");
                                    r.addClass("flowpaper_selected_default");
                                    r.css("width", E * x + "px");
                                    r.css("left", y + E * A + "px");
                                    if ("Portrait" == c.ba || "SinglePage" == c.ba) {
                                        jQuery(c.Ia).append(r), eb.browser.rb.Bb ? jQuery("#pagesContainer_" + g.ja).scrollTo(r, 0, {
                                            axis: "xy",
                                            offset: -30
                                        }) : jQuery("#pagesContainer_" + g.ja).data("jsp").scrollToElement(r, !1);
                                    }
                                    c.ba == g.Pa(c) && g.xb(c).Xj(g, c, r, d);
                                    "SinglePage" == c.ba && jQuery("#dummyPage_0_" + g.ja + "_textoverlay").append(r);
                                    "BookView" == c.ba && (0 == h ? jQuery("#dummyPage_0_" + g.ja + "_1_textoverlay").append(r) : jQuery("#dummyPage_" + (h - 1) % 2 + "_" + g.ja + "_" + ((h - 1) % 2 + 1) + "_textoverlay").append(r));
                                    "TwoPage" == c.ba && jQuery("#dummyPage_" + h % 2 + "_" + g.ja + "_" + (h % 2 + 1) + "_textoverlay").append(r);
                                } else {
                                    k = "";
                                }
                                v = u = -1;
                            } else {
                                0 < k.length && (k = "", u = -1);
                            }
                        }
                        m++;
                    }
                }
            }
        },
        Ce: function(c, d, e) {
            null == this.qd && (this.qd = Array(this.bb.length));
            null == this.qd[c.pageNumber] && (this.qd[c.pageNumber] = []);
            var g = {};
            g.cp = d;
            g.Cp = e;
            this.qd[c.pageNumber][this.qd[c.pageNumber].length] = g;
        },
        xm: function(c, d, e) {
            jQuery(c).unbind("onAddedTextOverlay");
            var g = "TwoPage" == c.ba || "BookView" == c.ba ? c.pages.la + c.pageNumber : c.pageNumber;
            "BookView" == c.ba && 0 < c.pages.la && 1 == c.pageNumber && (g = g - 2);
            "SinglePage" == c.ba && (g = c.pages.la);
            for (var h = this.Ua[g].tg, f = -1, k = -1, m = 0, n = 0; n < h.length; n++) {
                var u = h[n] + "";
                m >= d && -1 == f && (f = n);
                if (m + u.length >= d + e && -1 == k && (k = n, -1 != f)) {
                    break;
                }
                m += u.length;
            }
            for (d = f; d < k + 1; d++) {
                c.ba == this.Pa(c) ? jQuery(this.Ua[g].positions[d].el).clone() : (jQuery(this.Ua[g].positions[d].el).addClass("flowpaper_selected"), jQuery(this.Ua[g].positions[d].el).addClass("flowpaper_selected_yellow"), jQuery(this.Ua[g].positions[d].el).addClass("flowpaper_selected_searchmatch"));
            }
        },
        La: function(c, d) {
            this.lc(c, null == d, d);
        }
    };
    return f;
}();
window.WordPage = function(f, c) {
    this.ja = f;
    this.pageNumber = c;
    this.tg = [];
    this.positions = null;
    this.To = function(c, e) {
        this.tg[c] = e;
    };
    this.Po = function(c) {
        this.positions = c;
    };
    this.match = function(c, e) {
        var g, h = null;
        g = "#page_" + this.pageNumber + "_" + this.ja;
        0 == jQuery(g).length && (g = "#dummyPage_" + this.pageNumber + "_" + this.ja);
        g = jQuery(g).offset();
        "SinglePage" == window.$FlowPaper(this.ja).ba && (g = "#dummyPage_0_" + this.ja, g = jQuery(g).offset());
        if ("TwoPage" == window.$FlowPaper(this.ja).ba || "BookView" == window.$FlowPaper(this.ja).ba) {
            g = 0 == this.pageNumber || "TwoPage" == window.$FlowPaper(this.ja).ba ? jQuery("#dummyPage_" + this.pageNumber % 2 + "_" + this.ja + "_" + (this.pageNumber % 2 + 1) + "_textoverlay").offset() : jQuery("#dummyPage_" + (this.pageNumber - 1) % 2 + "_" + this.ja + "_" + ((this.pageNumber - 1) % 2 + 1) + "_textoverlay").offset();
        }
        c.top = c.top - g.top;
        c.left = c.left - g.left;
        for (g = 0; g < this.positions.length; g++) {
            this.Ln(c, this.positions[g], e) && (null == h || null != h && h.top < this.positions[g].top || null != h && h.top <= this.positions[g].top && null != h && h.left < this.positions[g].left) && (h = this.positions[g], h.pageNumber = this.pageNumber);
        }
        return h;
    };
    this.Uk = function(c) {
        for (var e = 0; e < this.positions.length; e++) {
            if (this.positions[e].el == "#" + c) {
                return this.positions[e];
            }
        }
        return null;
    };
    this.Ln = function(c, e, g) {
        return e ? g ? c.left + 3 >= e.left && c.left - 3 <= e.right && c.top + 3 >= e.top && c.top - 3 <= e.bottom : c.left + 3 >= e.left && c.top + 3 >= e.top : !1;
    };
    this.bf = function(c, e) {
        var g = window.a,
            h = window.b,
            f = new ha,
            k, m, n = 0,
            u = -1;
        if (null == g) {
            return f;
        }
        if (g && h) {
            var v = [],
                p;
            g.top > h.top ? (k = h, m = g) : (k = g, m = h);
            for (k = k.i; k <= m.i; k++) {
                if (this.positions[k]) {
                    var q = jQuery(this.positions[k].el);
                    0 != q.length && (p = parseInt(q.attr("id").substring(q.attr("id").indexOf("word_") + 5)), u = parseInt(q.attr("id").substring(q.attr("id").indexOf("page_") + 5, q.attr("id").indexOf("word_") - 1)) + 1, 0 <= p && v.push(this.tg[p]), n++, c && (q.addClass("flowpaper_selected"), q.addClass(e), "flowpaper_selected_strikeout" != e || q.data("adjusted") || (p = q.height(), q.css("margin-top", p / 2 - p / 3 / 1.5), q.height(p / 2.3), q.data("adjusted", !0))));
                }
            }
            eb.platform.touchdevice || jQuery(".flowpaper_selector").val(v.join("")).select();
        } else {
            eb.platform.touchdevice || jQuery("#selector").val("");
        }
        f.hr = n;
        f.Zr = g.left;
        f.$r = g.right;
        f.as = g.top;
        f.Yr = g.bottom;
        f.Vr = g.left;
        f.Wr = g.right;
        f.Xr = g.top;
        f.Ur = g.bottom;
        f.ln = null != v && 0 < v.length ? v[0] : null;
        f.qr = null != v && 0 < v.length ? v[v.length - 1] : f.ln;
        f.mn = null != g ? g.i : -1;
        f.rr = null != h ? h.i : f.mn;
        f.text = null != v ? v.join("") : "";
        f.page = u;
        f.Sr = this;
        return f;
    };
};

function ha() {}

function T(f) {
    var c = hoverPage;
    if (f = window["wordPageList_" + f]) {
        return f.length >= c ? f[c] : null;
    }
}
var V = function() {
        function f(c, d, e, g) {
            this.aa = d;
            this.ia = c;
            this.pages = {};
            this.selectors = {};
            this.container = "pagesContainer_" + e;
            this.da = "#" + this.container;
            this.la = null == g ? 0 : g - 1;
            this.ve = g;
            this.Od = this.Cf = null;
            this.Qc = this.Pc = -1;
            this.me = this.pd = 0;
            this.initialized = !1;
            this.ja = this.aa.ja;
            this.document = this.aa.document;
        }
        f.prototype = {
            ga: function(c) {
                if (0 < c.indexOf("undefined")) {
                    return jQuery(null);
                }
                this.selectors || (this.selectors = {});
                this.selectors[c] || (this.selectors[c] = jQuery(c));
                return this.selectors[c];
            },
            Wi: function() {
                null != this.ki && (window.clearTimeout(this.ki), this.ki = null);
                this.aa.ca && this.aa.ba == this.aa.ca.na && this.aa.ca.pb.Wi(this);
            },
            ic: function() {
                return this.aa.ca && this.aa.ba == this.aa.ca.na && this.aa.ca.pb.ic(this) || "SinglePage" == this.aa.ba;
            },
            Co: function() {
                return !(this.aa.ca && this.aa.ca.pb.ic(this));
            },
            Xa: function(c, d, e) {
                var g = this.aa.scale;
                this.aa.scale = c;
                if ("TwoPage" == this.aa.ba || "BookView" == this.aa.ba) {
                    var f = 100 * c + "%";
                    eb.platform.touchdevice || this.ga(this.da).css({
                        width: f,
                        "margin-left": this.kf()
                    });
                }
                this.pages[0] && (this.pages[0].scale = c);
                for (f = 0; f < this.document.numPages; f++) {
                    this.kb(f) && (this.pages[f].scale = c, this.pages[f].Xa());
                }
                this.aa.ca && this.aa.ba == this.aa.ca.na && this.aa.ca.pb.Xa(this, g, c, d, e);
            },
            dispose: function() {
                for (var c = 0; c < this.document.numPages; c++) {
                    this.pages[c].dispose(), delete this.pages[c];
                }
                this.selectors = this.pages = this.ia = this.aa = null;
            },
            resize: function(c, d, e) {
                if ("Portrait" == this.aa.ba || "SinglePage" == this.aa.ba) {
                    d += eb.browser.rb.Bb ? 0 : 14, c = c - (eb.browser.msie ? 0 : 2);
                }
                "ThumbView" == this.aa.ba && (d = d - 10);
                this.ga(this.da).css({
                    width: c,
                    height: d
                });
                "TwoPage" == this.aa.ba && (this.aa.Aj = this.ia.height() - (eb.platform.touchdevice ? 0 : 27), this.aa.pg = c / 2 - 2, this.ga(this.da).height(this.aa.Aj), this.ga("#" + this.container + "_2").css("left", this.ga("#" + this.container).width() / 2), eb.platform.touchdevice || (this.ga(this.da + "_1").width(this.aa.pg), this.ga(this.da + "_2").width(this.aa.pg)));
                if (this.aa.ca && this.aa.ba == this.aa.ca.na) {
                    this.aa.ca.pb.resize(this, c, d, e);
                } else {
                    for (this.sd(), c = 0; c < this.document.numPages; c++) {
                        this.kb(c) && this.pages[c].Xa();
                    }
                }
                this.Bj = null;
                null != this.jScrollPane && (this.jScrollPane.data("jsp").reinitialise(this.Oc), this.jScrollPane.data("jsp").scrollTo(this.Pc, this.Qc, !1));
            },
            je: function(c) {
                var d = this;
                if (!d.sa) {
                    var e = !1;
                    "function" === typeof d.Ci && d.er();
                    jQuery(".flowpaper_pageword").each(function() {
                        jQuery(this).hasClass("flowpaper_selected_default") && (e = !0);
                    });
                    null != d.touchwipe && (d.touchwipe.config.preventDefaultEvents = !1);
                    d.ic() || (jQuery(".flowpaper_pageword_" + d.ja).remove(), setTimeout(function() {
                        "TwoPage" != d.aa.ba && "BookView" != d.aa.ba || d.fc();
                        d.La();
                        e && d.getPage(d.aa.gb - 1).xc(d.aa.Pd, !1);
                    }, 500));
                    d.aa.ca && d.aa.ba == d.aa.ca.na ? d.aa.ca.pb.je(d, c) : d.Xa(1);
                    null != d.jScrollPane ? (d.jScrollPane.data("jsp").reinitialise(d.Oc), d.jScrollPane.data("jsp").scrollTo(d.Pc, d.Qc, !1)) : "TwoPage" != d.aa.ba && "BookView" != d.aa.ba || d.ga(d.da).parent().scrollTo({
                        left: d.Pc + "px",
                        top: d.Qc + "px"
                    }, 0, {
                        axis: "xy"
                    });
                }
            },
            fd: function(c) {
                var d = this;
                if (!d.sa) {
                    var e = !1;
                    null != d.touchwipe && (d.touchwipe.config.preventDefaultEvents = !0);
                    "function" === typeof d.Ci && d.fr();
                    jQuery(".flowpaper_pageword").each(function() {
                        jQuery(this).hasClass("flowpaper_selected_default") && (e = !0);
                    });
                    d.ic() || jQuery(".flowpaper_pageword_" + d.ja).remove();
                    d.aa.ca && d.aa.ba == d.aa.ca.na ? d.aa.ca.pb.fd(d, c) : d.Xa(window.FitHeightScale);
                    setTimeout(function() {
                        d.La();
                        e && d.getPage(d.aa.gb - 1).xc(d.aa.Pd, !1);
                    }, 500);
                    d.La();
                    null != d.jScrollPane ? (d.jScrollPane.data("jsp").scrollTo(0, 0, !1), d.jScrollPane.data("jsp").reinitialise(d.Oc)) : d.ga(d.da).parent().scrollTo({
                        left: 0,
                        top: 0
                    }, 0, {
                        axis: "xy"
                    });
                }
            },
            Vi: function() {
                var c = this;
                c.Ee();
                if (c.aa.ca && c.aa.ba == c.aa.ca.na) {
                    c.aa.ca.pb.Vi(c);
                } else {
                    if ("SinglePage" == c.aa.ba || "TwoPage" == c.aa.ba || "BookView" == c.aa.ba) {
                        c.touchwipe = c.ga(c.da).touchwipe({
                            wipeLeft: function() {
                                if (!c.aa.Mc && !window.Db && null == c.sa && ("TwoPage" != c.aa.ba && "BookView" != c.aa.ba || 1 == c.aa.scale || c.next(), "SinglePage" == c.aa.ba)) {
                                    var d = jQuery(c.da).width() - 5,
                                        e = 1 < c.aa.getTotalPages() ? c.aa.ua - 1 : 0;
                                    0 > e && (e = 0);
                                    var g = c.getPage(e).dimensions.Ca / c.getPage(e).dimensions.Na,
                                        d = Math.round(100 * (d / (c.getPage(e).ab * g) - 0.03));
                                    100 * c.aa.scale < 1.2 * d && c.next();
                                }
                            },
                            wipeRight: function() {
                                if (!c.aa.Mc && !window.Db && null == c.sa && ("TwoPage" != c.aa.ba && "BookView" != c.aa.ba || 1 == c.aa.scale || c.previous(), "SinglePage" == c.aa.ba)) {
                                    var d = jQuery(c.da).width() - 15,
                                        e = 1 < c.aa.getTotalPages() ? c.aa.ua - 1 : 0;
                                    0 > e && (e = 0);
                                    var g = c.getPage(e).dimensions.Ca / c.getPage(e).dimensions.Na,
                                        d = Math.round(100 * (d / (c.getPage(e).ab * g) - 0.03));
                                    100 * c.aa.scale < 1.2 * d && c.previous();
                                }
                            },
                            preventDefaultEvents: "TwoPage" == c.aa.ba || "BookView" == c.aa.ba || "SinglePage" == c.aa.ba,
                            min_move_x: eb.platform.Ib ? 150 : 200,
                            min_move_y: 500
                        });
                    }
                }
                if (eb.platform.mobilepreview) {
                    c.ga(c.da).on("mousedown", function(d) {
                        c.Pc = d.pageX;
                        c.Qc = d.pageY;
                    });
                }
                c.ga(c.da).on("touchstart", function(d) {
                    c.Pc = d.originalEvent.touches[0].pageX;
                    c.Qc = d.originalEvent.touches[0].pageY;
                });
                c.ga(c.da).on(eb.platform.mobilepreview ? "mouseup" : "touchend", function() {
                    null != c.aa.pages.jScrollPane && c.aa.pages.jScrollPane.data("jsp").enable && c.aa.pages.jScrollPane.data("jsp").enable();
                    if (null != c.zb) {
                        for (var d = 0; d < c.document.numPages; d++) {
                            c.kb(d) && c.ga(c.pages[d].Ka).transition({
                                y: 0,
                                scale: 1
                            }, 0, "ease", function() {
                                c.sa > c.aa.scale && c.sa - c.aa.scale < c.aa.document.ZoomInterval && (c.sa += c.aa.document.ZoomInterval);
                                0 < c.Hc - c.Yd && c.sa < c.aa.scale && (c.sa = c.aa.scale + c.aa.document.ZoomInterval);
                                c.aa.lb(c.sa, {
                                    Ig: !0
                                });
                                c.sa = null;
                            });
                        }
                        c.pages[0] && c.pages[0].Ee();
                        c.ga(c.da).addClass("flowpaper_pages_border");
                        c.$i = c.zb < c.sa;
                        c.zb = null;
                        c.jg = null;
                        c.sa = null;
                        c.Ab = null;
                        c.pc = null;
                    }
                });
                c.aa.ca && c.aa.ba == c.aa.ca.na ? c.aa.ca.pb.Zj(c) : eb.platform.touchdevice && c.ga(c.da).doubletap(function(d) {
                    if ("TwoPage" == c.aa.ba || "BookView" == c.aa.ba) {
                        "TwoPage" != c.aa.ba && "BookView" != c.aa.ba || 1 == c.aa.scale ? "TwoPage" != c.aa.ba && "BookView" != c.aa.ba || 1 != c.aa.scale || c.fd() : c.je(), d.preventDefault();
                    }
                }, null, 300);
                c.ga(c.da).on("scroll gesturechange", function() {
                    "SinglePage" == c.aa.ba ? c.aa.renderer.tb && !c.sa && c.aa.renderer.Xc(c.pages[0]) : c.aa.ca && c.aa.ba == c.aa.ca.na || (eb.platform.ios && c.gj(-1 * c.ga(c.da).scrollTop()), eb.platform.ios ? (setTimeout(function() {
                        c.sg();
                        c.ne();
                    }, 1000), setTimeout(function() {
                        c.sg();
                        c.ne();
                    }, 2000), setTimeout(function() {
                        c.sg();
                        c.ne();
                    }, 3000)) : c.sg(), c.ne(), c.La(), null != c.Cf && (window.clearTimeout(c.Cf), c.Cf = null), c.Cf = setTimeout(function() {
                        c.Fk();
                        window.clearTimeout(c.Cf);
                        c.Cf = null;
                    }, 100), c.Ar = !0);
                });
                this.Fk();
            },
            Zj: function() {},
            gj: function(c) {
                for (var d = 0; d < this.document.numPages; d++) {
                    this.kb(d) && this.pages[d].gj(c);
                }
            },
            Ol: function() {
                var c = this.ga(this.da).css("transform") + "";
                null != c && (c = c.replace("translate", ""), c = c.replace("(", ""), c = c.replace(")", ""), c = c.replace("px", ""), c = c.split(","), this.pd = parseFloat(c[0]), this.me = parseFloat(c[1]), isNaN(this.pd) && (this.me = this.pd = 0));
            },
            dk: function(c, d) {
                this.ga(this.da).transition({
                    x: this.pd + (c - this.Ab) / this.aa.scale,
                    y: this.me + (d - this.pc) / this.aa.scale
                }, 0);
            },
            Fg: function(c, d) {
                this.aa.ca && this.aa.ca.pb.Fg(this, c, d);
            },
            xn: function(c, d) {
                var e = this.ia.width();
                return c / d - this.Bd / e / d * e;
            },
            yn: function(c) {
                var d = this.ia.height();
                return c / this.aa.scale - this.Cd / d / this.aa.scale * d;
            },
            Ee: function() {
                this.aa.ca && this.aa.ca.pb.Ee(this);
            },
            Ai: function() {
                if (this.aa.ca) {
                    return this.aa.ca.pb.Ai(this);
                }
            },
            getTotalPages: function() {
                return this.document.numPages;
            },
            bi: function(c) {
                var d = this;
                c.empty();
                jQuery(d.aa.renderer).on("onTextDataUpdated", function() {
                    d.La(d);
                });
                null != d.aa.Od || d.aa.document.DisableOverflow || d.aa.ac || (d.aa.Od = d.ia.height(), eb.platform.touchonlydevice ? d.aa.$d || d.ia.height(d.aa.Od - 10) : d.ia.height(d.aa.Od - 27));
                var e = d.aa.ca && d.aa.ca.backgroundColor ? "background-color:" + d.aa.ca.backgroundColor + ";" : "";
                d.aa.ca && d.aa.ca.backgroundImage && (e = "background-color:transparent;");
                if ("Portrait" == d.aa.ba || "SinglePage" == d.aa.ba) {
                    eb.platform.touchonlydevice && "SinglePage" == d.aa.ba && (eb.browser.rb.Bb = !1);
                    var g = jQuery(d.aa.ea).height(),
                        f = eb.platform.touchonlydevice ? 31 : 26,
                        g = d.ia.height() + (eb.browser.rb.Bb ? window.annotations ? 0 : f - g : -5),
                        f = d.ia.width() - 2,
                        l = 1 < d.ve ? "visibility:hidden;" : "",
                        k = eb.browser.msie && 9 > eb.browser.version ? "position:relative;" : "";
                    d.aa.document.DisableOverflow ? c.append("<div id='" + d.container + "' class='flowpaper_pages' style='overflow:hidden;padding:0;margin:0;'></div>") : c.append("<div id='" + d.container + "' class='flowpaper_pages " + (window.annotations ? "" : "flowpaper_pages_border") + "' style='" + (eb.platform.Wl ? "touch-action: none;" : "") + "-moz-user-select:none;-webkit-user-select:none;" + k + ";" + l + "height:" + g + "px;width:" + f + "px;overflow-y: auto;overflow-x: auto;;-webkit-overflow-scrolling: touch;-webkit-backface-visibility: hidden;-webkit-perspective: 1000;" + e + ";'></div>");
                    eb.browser.rb.Bb ? eb.platform.touchonlydevice ? (jQuery(c).css("overflow-y", "auto"), jQuery(c).css("overflow-x", "auto"), jQuery(c).css("-webkit-overflow-scrolling", "touch")) : (jQuery(c).css("overflow-y", "visible"), jQuery(c).css("overflow-x", "visible"), jQuery(c).css("-webkit-overflow-scrolling", "visible")) : jQuery(c).css("-webkit-overflow-scrolling", "hidden");
                    eb.platform.touchdevice && (eb.platform.ipad || eb.platform.iphone || eb.platform.android || eb.platform.Wl) && (jQuery(d.da).on("touchmove", function(c) {
                        if (!eb.platform.ios && 2 == c.originalEvent.touches.length && (d.aa.pages.jScrollPane && d.aa.pages.jScrollPane.data("jsp").disable(), 1 != d.gi)) {
                            c.preventDefault && c.preventDefault();
                            c.returnValue = !1;
                            c = Math.sqrt((c.originalEvent.touches[0].pageX - c.originalEvent.touches[1].pageX) * (c.originalEvent.touches[0].pageX - c.originalEvent.touches[1].pageX) + (c.originalEvent.touches[0].pageY - c.originalEvent.touches[1].pageY) * (c.originalEvent.touches[0].pageY - c.originalEvent.touches[1].pageY));
                            c *= 2;
                            null == d.sa && (d.ga(d.da).removeClass("flowpaper_pages_border"), d.zb = 1, d.jg = c);
                            null == d.sa && (d.zb = 1, d.Yd = 1 + (jQuery(d.pages[0].Ka).width() - d.ia.width()) / d.ia.width());
                            var e = c = (d.zb + (c - d.jg) / jQuery(d.da).width() - d.zb) / d.zb;
                            d.ic() || (1 < e && (e = 1), -0.3 > e && (e = -0.3), 0 < c && (c *= 0.7));
                            d.Hc = d.Yd + d.Yd * c;
                            d.Hc < d.aa.document.MinZoomSize && (d.Hc = d.aa.document.MinZoomSize);
                            d.Hc > d.aa.document.MaxZoomSize && (d.Hc = d.aa.document.MaxZoomSize);
                            d.uc = 1 + (d.Hc - d.Yd);
                            d.sa = d.pages[0].uk(jQuery(d.pages[0].Ka).width() * d.uc);
                            d.sa < d.aa.document.MinZoomSize && (d.sa = d.aa.document.MinZoomSize);
                            d.sa > d.aa.document.MaxZoomSize && (d.sa = d.aa.document.MaxZoomSize);
                            jQuery(d.pages[0].Ka).width() > jQuery(d.pages[0].Ka).height() ? d.sa < d.aa.Pg() && (d.uc = d.fg, d.sa = d.aa.Pg()) : d.sa < d.aa.Me() && (d.uc = d.fg, d.sa = d.aa.Me());
                            d.fg = d.uc;
                            if (d.ic() && 0 < d.uc) {
                                for (jQuery(".flowpaper_annotation_" + d.ja).hide(), c = 0; c < d.document.numPages; c++) {
                                    d.kb(c) && jQuery(d.pages[c].Ka).transition({
                                        transformOrigin: "50% 50%",
                                        scale: d.uc
                                    }, 0, "ease", function() {});
                                }
                            }
                        }
                    }), jQuery(d.da).on("touchstart", function() {}), jQuery(d.da).on("gesturechange", function(c) {
                        if (1 != d.zp && 1 != d.gi) {
                            d.aa.renderer.tb && jQuery(".flowpaper_flipview_canvas_highres").hide();
                            null == d.sa && (d.zb = 1, d.Yd = 1 + (jQuery(d.pages[0].Ka).width() - d.ia.width()) / d.ia.width());
                            var e, g = e = (c.originalEvent.scale - d.zb) / d.zb;
                            d.ic() || (1 < g && (g = 1), -0.3 > g && (g = -0.3), 0 < e && (e *= 0.7));
                            d.Hc = d.Yd + d.Yd * e;
                            d.Hc < d.aa.document.MinZoomSize && (d.Hc = d.aa.document.MinZoomSize);
                            d.Hc > d.aa.document.MaxZoomSize && (d.Hc = d.aa.document.MaxZoomSize);
                            d.uc = 1 + (d.Hc - d.Yd);
                            d.sa = d.pages[0].uk(jQuery(d.pages[0].Ka).width() * d.uc);
                            jQuery(d.pages[0].Ka).width() > jQuery(d.pages[0].Ka).height() ? d.sa < d.aa.Pg() && (d.uc = d.fg, d.sa = d.aa.Pg()) : d.sa < d.aa.Me() && (d.uc = d.fg, d.sa = d.aa.Me());
                            d.sa < d.aa.document.MinZoomSize && (d.sa = d.aa.document.MinZoomSize);
                            d.sa > d.aa.document.MaxZoomSize && (d.sa = d.aa.document.MaxZoomSize);
                            c.preventDefault && c.preventDefault();
                            d.fg = d.uc;
                            if (d.ic() && 0 < d.uc) {
                                for (jQuery(".flowpaper_annotation_" + d.ja).hide(), c = 0; c < d.document.numPages; c++) {
                                    d.kb(c) && jQuery(d.pages[c].Ka).transition({
                                        transformOrigin: "50% 50%",
                                        scale: d.uc
                                    }, 0, "ease", function() {});
                                }
                            }!d.ic() && (0.7 <= g || -0.3 >= g) && (d.zp = !0, d.sa > d.aa.scale && d.sa - d.aa.scale < d.aa.document.ZoomInterval && (d.sa += d.aa.document.ZoomInterval), d.aa.lb(d.sa), d.sa = null);
                        }
                    }), jQuery(d.da).on("gestureend", function() {}));
                }
                if ("TwoPage" == d.aa.ba || "BookView" == d.aa.ba) {
                    g = d.ia.height() - (eb.browser.msie ? 37 : 0), f = d.ia.width() - (eb.browser.msie ? 0 : 20), e = 0, 1 == d.aa.ua && "BookView" == d.aa.ba && (e = f / 3, f -= e), eb.platform.touchdevice ? eb.browser.rb.Bb ? (c.append("<div id='" + d.container + "' style='-moz-user-select:none;-webkit-user-select:none;margin-left:" + e + "px;position:relative;width:100%;' class='flowpaper_twopage_container'><div id='" + d.container + "_1' class='flowpaper_pages' style='position:absolute;top:0px;height:99%;margin-top:20px;'></div><div id='" + d.container + "_2' class='flowpaper_pages' style='position:absolute;top:0px;height:99%;margin-top:20px;'></div></div>"), jQuery(c).css("overflow-y", "scroll"), jQuery(c).css("overflow-x", "scroll"), jQuery(c).css("-webkit-overflow-scrolling", "touch")) : (c.append("<div id='" + d.container + "_jpane' style='-moz-user-select:none;-webkit-user-select:none;height:" + g + "px;width:100%;" + (window.eb.browser.msie || eb.platform.android ? "overflow-y: scroll;overflow-x: scroll;" : "overflow-y: auto;overflow-x: auto;") + ";-webkit-overflow-scrolling: touch;'><div id='" + d.container + "' style='margin-left:" + e + "px;position:relative;height:100%;width:100%' class='flowpaper_twopage_container'><div id='" + d.container + "_1' class='flowpaper_pages' style='position:absolute;top:0px;height:99%;margin-top:20px;'></div><div id='" + d.container + "_2' class='flowpaper_pages' style='position:absolute;top:0px;height:99%;margin-top:20px;'></div></div></div>"), jQuery(c).css("overflow-y", "visible"), jQuery(c).css("overflow-x", "visible"), jQuery(c).css("-webkit-overflow-scrolling", "visible")) : (c.append("<div id='" + d.container + "' style='-moz-user-select:none;-webkit-user-select:none;margin-left:" + e + "px;position:relative;' class='flowpaper_twopage_container'><div id='" + d.container + "_1' class='flowpaper_pages' style='position:absolute;top:0px;height:99%;margin-top:" + (eb.browser.msie ? 10 : 20) + "px;'></div><div id='" + d.container + "_2' class='flowpaper_pages " + ("BookView" == d.aa.ba && 2 > d.ve ? "flowpaper_hidden" : "") + "' style='position:absolute;top:0px;height:99%;margin-top:" + (eb.browser.msie ? 10 : 20) + "px;'></div></div>"), jQuery(c).css("overflow-y", "auto"), jQuery(c).css("overflow-x", "auto"), jQuery(c).css("-webkit-overflow-scrolling", "touch")), null == d.aa.Aj && (d.aa.Aj = d.ia.height() - (eb.platform.touchdevice ? 0 : 27), d.aa.pg = d.ga(d.da).width() / 2 - 2), d.ga(d.da).css({
                        height: "90%"
                    }), d.ga("#" + this.container + "_2").css("left", d.ga("#" + d.container).width() / 2), eb.platform.touchdevice || (d.ga(d.da + "_1").width(d.aa.pg), d.ga(d.da + "_2").width(d.aa.pg));
                }
                "ThumbView" == d.aa.ba && (jQuery(c).css("overflow-y", "visible"), jQuery(c).css("overflow-x", "visible"), jQuery(c).css("-webkit-overflow-scrolling", "visible"), k = eb.browser.msie && 9 > eb.browser.version ? "position:relative;" : "", c.append("<div id='" + this.container + "' class='flowpaper_pages' style='" + k + ";" + (eb.platform.touchdevice ? "padding-left:10px;" : "") + (eb.browser.msie ? "overflow-y: scroll;overflow-x: hidden;" : "overflow-y: auto;overflow-x: hidden;-webkit-overflow-scrolling: touch;") + "'></div>"), jQuery(".flowpaper_pages").height(d.ia.height() - 0));
                d.aa.ca && d.aa.ca.pb.bi(d, c);
                d.ia.trigger("onPagesContainerCreated");
                jQuery(d).bind("onScaleChanged", d.Wi);
            },
            create: function(c) {
                var d = this;
                d.bi(c);
                eb.browser.rb.Bb || "ThumbView" == d.aa.ba || (d.Oc = {}, "TwoPage" != d.aa.ba && "BookView" != d.aa.ba) || (d.jScrollPane = d.ga(d.da + "_jpane").jScrollPane(d.Oc));
                for (c = 0; c < this.document.numPages; c++) {
                    d.kb(c) && this.addPage(c);
                }
                d.Vi();
                if (!eb.browser.rb.Bb) {
                    if ("Portrait" == d.aa.ba || "SinglePage" == d.aa.ba) {
                        d.jScrollPane = d.ga(this.da).jScrollPane(d.Oc);
                    }!window.zine || d.aa.ca && d.aa.ca.na == d.aa.ba || jQuery(d.ga(this.da)).bind("jsp-initialised", function() {
                        jQuery(this).find(".jspHorizontalBar, .jspVerticalBar").hide();
                    }).jScrollPane().hover(function() {
                        jQuery(this).find(".jspHorizontalBar, .jspVerticalBar").stop().fadeTo("fast", 0.9);
                    }, function() {
                        jQuery(this).find(".jspHorizontalBar, .jspVerticalBar").stop().fadeTo("fast", 0);
                    });
                }
                eb.browser.rb.Bb || "ThumbView" != d.aa.ba || (d.jScrollPane = d.ga(d.da).jScrollPane(d.Oc));
                1 < d.ve && "Portrait" == d.aa.ba && setTimeout(function() {
                    d.scrollTo(d.ve, !0);
                    d.ve = -1;
                    jQuery(d.da).css("visibility", "visible");
                }, 500);
                d.ve && "SinglePage" == d.aa.ba && jQuery(d.da).css("visibility", "visible");
            },
            getPage: function(c) {
                if ("TwoPage" == this.aa.ba || "BookView" == this.aa.ba) {
                    if (0 != c % 2) {
                        return this.pages[1];
                    }
                    if (0 == c % 2) {
                        return this.pages[0];
                    }
                } else {
                    return "SinglePage" == this.aa.ba ? this.pages[0] : this.pages[c];
                }
            },
            kb: function(c) {
                if (this.document.DisplayRange) {
                    var d = this.document.DisplayRange.split("-");
                    if (c + 1 >= parseInt(d[0]) && c <= parseInt(d[1]) - 1) {
                        return !0;
                    }
                } else {
                    return ("TwoPage" == this.aa.ba || "BookView" == this.aa.ba) && (0 == c || 1 == c) || "TwoPage" != this.aa.ba && "BookView" != this.aa.ba;
                }
            },
            addPage: function(c) {
                this.pages[c] = new U(this.ja, c, this, this.ia, this.aa, this.Rg(c));
                this.pages[c].create(this.ga(this.da));
                jQuery(this.aa.ia).trigger("onPageCreated", c);
            },
            Rg: function(c) {
                for (var d = 0; d < this.document.dimensions.length; d++) {
                    if (this.document.dimensions[d].page == c) {
                        return this.document.dimensions[d];
                    }
                }
                return {
                    width: -1,
                    height: -1
                };
            },
            scrollTo: function(c, d) {
                if (this.la + 1 != c || d) {
                    !eb.browser.rb.Bb && this.jScrollPane ? this.jScrollPane.data("jsp").scrollToElement(this.pages[c - 1].ga(this.pages[c - 1].Ia), !0, !1) : jQuery(this.da).scrollTo && jQuery(this.da).scrollTo(this.pages[c - 1].ga(this.pages[c - 1].Ia), 0);
                }
                this.La();
            },
            Fo: function() {
                for (var c = 0; c < this.getTotalPages(); c++) {
                    this.kb(c) && this.pages[c] && this.pages[c].gc && window.clearTimeout(this.pages[c].gc);
                }
            },
            Fk: function() {
                this.sd();
            },
            sd: function() {
                var c = this;
                null != c.Qd && (window.clearTimeout(c.Qd), c.Qd = null);
                c.Qd = setTimeout(function() {
                    c.fc();
                }, 200);
            },
            vj: function() {
                if (null != this.jScrollPane) {
                    try {
                        this.jScrollPane.data("jsp").reinitialise(this.Oc);
                    } catch (c) {}
                }
            },
            fc: function(c) {
                var d = this;
                if (d.aa) {
                    if (d.aa.ca && d.aa.ba == d.aa.ca.na) {
                        d.aa.ca.pb.fc(d, c);
                    } else {
                        null != d.Qd && (window.clearTimeout(d.Qd), d.Qd = null);
                        c = d.ga(this.da).scrollTop();
                        for (var e = 0; e < this.document.numPages; e++) {
                            if (this.pages[e] && d.kb(e)) {
                                var g = !d.pages[e].ib;
                                this.pages[e].Nc(c, d.ga(this.da).height(), !0) ? (g && d.ia.trigger("onVisibilityChanged", e + 1), this.pages[e].ib = !0, this.pages[e].load(function() {
                                    if ("TwoPage" == d.aa.ba || "BookView" == d.aa.ba) {
                                        d.ga(d.da).is(":animated") || 1 == d.aa.scale || (d.ga(d.da).css("margin-left", d.kf()), d.ga("#" + this.container + "_2").css("left", d.ga("#" + d.container).width() / 2)), d.initialized || null == d.jScrollPane || (d.jScrollPane.data("jsp").reinitialise(d.Oc), d.initialized = !0);
                                    }
                                }), this.pages[e].Xn(), this.pages[e].La()) : "TwoPage" != d.aa.ba && "BookView" != d.aa.ba && this.pages[e].unload();
                            }
                        }
                    }
                }
            },
            ne: function() {
                this.aa.ba != this.aa.na() ? this.aa.dd(this.la + 1) : this.aa.dd(this.la);
            },
            La: function(c) {
                c = c ? c : this;
                for (var d = 0; d < c.document.numPages; d++) {
                    c.kb(d) && c.pages[d] && c.pages[d].ib && c.pages[d].La();
                }
            },
            sg: function() {
                for (var c = this.la, d = this.ga(this.da).scrollTop(), e = 0; e < this.document.numPages; e++) {
                    if (this.kb(e) && "SinglePage" != this.aa.ba) {
                        var g = !this.pages[e].ib;
                        if (this.pages[e].Nc(d, this.ga(this.da).height(), !1)) {
                            c = e;
                            g && this.ia.trigger("onVisibilityChanged", e + 1);
                            break;
                        }
                    }
                }
                this.la != c && this.ia.trigger("onCurrentPageChanged", c + 1);
                this.la = c;
            },
            setCurrentCursor: function(c) {
                for (var d = 0; d < this.document.numPages; d++) {
                    this.kb(d) && ("TextSelectorCursor" == c ? jQuery(this.pages[d].ma).addClass("flowpaper_nograb") : jQuery(this.pages[d].ma).removeClass("flowpaper_nograb"));
                }
            },
            gotoPage: function(c) {
                this.aa.gotoPage(c);
            },
            Zf: function(c, d) {
                c = parseInt(c);
                var e = this;
                e.aa.renderer.zc && e.aa.renderer.zc(e.pages[0]);
                jQuery(".flowpaper_pageword").remove();
                jQuery(".flowpaper_interactiveobject_" + e.ja).remove();
                e.pages[0].unload();
                e.pages[0].visible = !0;
                var g = e.ga(e.da).scrollTop();
                e.aa.dd(c);
                e.ia.trigger("onCurrentPageChanged", c);
                e.pages[0].Nc(g, e.ga(this.da).height(), !0) && (e.ia.trigger("onVisibilityChanged", c + 1), e.pages[0].load(function() {
                    null != d && d();
                    e.sd();
                    null != e.jScrollPane && e.jScrollPane.data("jsp").reinitialise(e.Oc);
                }));
            },
            ag: function(c, d) {
                c = parseInt(c);
                var e = this;
                0 == c % 2 && 0 < c && "BookView" == e.aa.ba && c != e.getTotalPages() && (c += 1);
                c == e.getTotalPages() && "TwoPage" == e.aa.ba && 0 == e.getTotalPages() % 2 && (c = e.getTotalPages() - 1);
                0 == c % 2 && "TwoPage" == e.aa.ba && --c;
                c > e.getTotalPages() && (c = e.getTotalPages());
                jQuery(".flowpaper_pageword").remove();
                jQuery(".flowpaper_interactiveobject_" + e.ja).remove();
                if (c <= e.getTotalPages() && 0 < c) {
                    e.aa.dd(c);
                    e.la != c && e.ia.trigger("onCurrentPageChanged", c);
                    e.pages[0].unload();
                    e.pages[0].load(function() {
                        if ("TwoPage" == e.aa.ba || "BookView" == e.aa.ba) {
                            e.ga(e.da).animate({
                                "margin-left": e.kf()
                            }, {
                                duration: 250
                            }), e.ga("#" + this.container + "_2").css("left", e.ga("#" + e.container).width() / 2), e.Xa(e.aa.scale);
                        }
                    });
                    1 < e.aa.ua ? (e.ga(e.pages[1].ma + "_2").removeClass("flowpaper_hidden"), e.ga(e.da + "_2").removeClass("flowpaper_hidden")) : "BookView" == e.aa.ba && 1 == e.aa.ua && (e.ga(e.pages[1].ma + "_2").addClass("flowpaper_hidden"), e.ga(e.da + "_2").addClass("flowpaper_hidden"));
                    0 != e.getTotalPages() % 2 && "TwoPage" == e.aa.ba && c >= e.getTotalPages() && e.ga(e.pages[1].ma + "_2").addClass("flowpaper_hidden");
                    0 == e.getTotalPages() % 2 && "BookView" == e.aa.ba && c >= e.getTotalPages() && e.ga(e.pages[1].ma + "_2").addClass("flowpaper_hidden");
                    var g = e.ga(this.da).scrollTop();
                    e.pages[1].unload();
                    e.pages[1].visible = !0;
                    !e.ga(e.pages[1].ma + "_2").hasClass("flowpaper_hidden") && e.pages[1].Nc(g, e.ga(this.da).height(), !0) && (e.ia.trigger("onVisibilityChanged", c + 1), e.pages[1].load(function() {
                        null != d && d();
                        e.ga(e.da).animate({
                            "margin-left": e.kf()
                        }, {
                            duration: 250
                        });
                        e.ga("#" + this.container + "_2").css("left", e.ga("#" + e.container).width() / 2);
                        e.sd();
                        null != e.jScrollPane && e.jScrollPane.data("jsp").reinitialise(e.Oc);
                    }));
                }
            },
            rotate: function(c) {
                this.pages[c].rotate();
            },
            kf: function(c) {
                this.ia.width();
                var d = 0;
                1 != this.aa.ua || c || "BookView" != this.aa.ba ? (c = jQuery(this.da + "_2").width(), 0 == c && (c = this.ga(this.da + "_1").width()), d = (this.ia.width() - (this.ga(this.da + "_1").width() + c)) / 2) : d = (this.ia.width() / 2 - this.ga(this.da + "_1").width() / 2) * (this.aa.scale + 0.7);
                10 > d && (d = 0);
                return d;
            },
            previous: function() {
                var c = this;
                if ("Portrait" == c.aa.ba) {
                    var d = c.ga(c.da).scrollTop() - c.pages[0].height - 14;
                    0 > d && (d = 1);
                    eb.browser.rb.Bb ? c.ga(c.da).scrollTo(d, {
                        axis: "y",
                        duration: 500
                    }) : c.jScrollPane.data("jsp").scrollToElement(this.pages[c.aa.ua - 2].ga(this.pages[c.aa.ua - 2].Ia), !0, !0);
                }
                "SinglePage" == c.aa.ba && 0 < c.aa.ua - 1 && (eb.platform.touchdevice && 1 != this.aa.scale ? (c.aa.Mc = !0, c.ga(c.da).removeClass("flowpaper_pages_border"), c.ga(c.da).transition({
                    x: 1000
                }, 350, function() {
                    c.pages[0].unload();
                    c.ga(c.da).transition({
                        x: -800
                    }, 0);
                    c.jScrollPane ? c.jScrollPane.data("jsp").scrollTo(0, 0, !1) : c.ga(c.da).scrollTo(0, {
                        axis: "y",
                        duration: 0
                    });
                    c.Zf(c.aa.ua - 1, function() {});
                    c.ga(c.da).transition({
                        x: 0
                    }, 350, function() {
                        c.aa.Mc = !1;
                        window.annotations || c.ga(c.da).addClass("flowpaper_pages_border");
                    });
                })) : c.Zf(c.aa.ua - 1));
                c.aa.ca && c.aa.ba == c.aa.ca.na && c.aa.ca.pb.previous(c);
                "TwoPage" != c.aa.ba && "BookView" != c.aa.ba || 1 > c.aa.ua - 2 || (eb.platform.touchdevice && 1 != this.aa.scale ? (c.la = c.aa.ua - 2, c.aa.Mc = !0, c.ga(c.da).animate({
                    "margin-left": 1000
                }, {
                    duration: 350,
                    complete: function() {
                        jQuery(".flowpaper_interactiveobject_" + c.ja).remove();
                        1 == c.aa.ua - 2 && "BookView" == c.aa.ba && c.pages[1].ga(c.pages[1].ma + "_2").addClass("flowpaper_hidden");
                        setTimeout(function() {
                            c.ga(c.da).css("margin-left", -800);
                            c.pages[0].unload();
                            c.pages[1].unload();
                            c.ga(c.da).animate({
                                "margin-left": c.kf()
                            }, {
                                duration: 350,
                                complete: function() {
                                    setTimeout(function() {
                                        c.aa.Mc = !1;
                                        c.ag(c.aa.ua - 2);
                                    }, 500);
                                }
                            });
                        }, 500);
                    }
                })) : c.ag(c.aa.ua - 2));
            },
            next: function() {
                var c = this;
                if ("Portrait" == c.aa.ba) {
                    0 == c.aa.ua && (c.aa.ua = 1);
                    var d = c.aa.ua - 1;
                    100 < this.pages[c.aa.ua - 1].ga(this.pages[c.aa.ua - 1].Ia).offset().top - c.ia.offset().top ? d = c.aa.ua - 1 : d = c.aa.ua;
                    eb.browser.rb.Bb ? this.pages[d] && c.ga(c.da).scrollTo(this.pages[d].ga(this.pages[d].Ia), {
                        axis: "y",
                        duration: 500
                    }) : c.jScrollPane.data("jsp").scrollToElement(this.pages[c.aa.ua].ga(this.pages[c.aa.ua].Ia), !0, !0);
                }
                "SinglePage" == c.aa.ba && c.aa.ua < c.getTotalPages() && (eb.platform.touchdevice && 1 != c.aa.scale ? (c.aa.Mc = !0, c.ga(c.da).removeClass("flowpaper_pages_border"), c.ga(c.da).transition({
                    x: -1000
                }, 350, "ease", function() {
                    c.pages[0].unload();
                    c.ga(c.da).transition({
                        x: 1200
                    }, 0);
                    c.jScrollPane ? c.jScrollPane.data("jsp").scrollTo(0, 0, !1) : c.ga(c.da).scrollTo(0, {
                        axis: "y",
                        duration: 0
                    });
                    c.Zf(c.aa.ua + 1, function() {});
                    c.ga(c.da).transition({
                        x: 0
                    }, 350, "ease", function() {
                        window.annotations || c.ga(c.da).addClass("flowpaper_pages_border");
                        c.aa.Mc = !1;
                    });
                })) : c.Zf(c.aa.ua + 1));
                c.aa.ca && c.aa.ba == c.aa.ca.na && c.aa.ca.pb.next(c);
                if ("TwoPage" == c.aa.ba || "BookView" == c.aa.ba) {
                    if ("TwoPage" == c.aa.ba && c.aa.ua + 2 > c.getTotalPages()) {
                        return !1;
                    }
                    eb.platform.touchdevice && 1 != this.aa.scale ? (c.la = c.aa.ua + 2, c.aa.Mc = !0, c.ga(c.da).animate({
                        "margin-left": -1000
                    }, {
                        duration: 350,
                        complete: function() {
                            jQuery(".flowpaper_interactiveobject_" + c.ja).remove();
                            c.aa.ua + 2 <= c.getTotalPages() && 0 < c.aa.ua + 2 && c.pages[1].ga(c.pages[1].ma + "_2").removeClass("flowpaper_hidden");
                            setTimeout(function() {
                                c.ga(c.da).css("margin-left", 800);
                                c.pages[0].unload();
                                c.pages[1].unload();
                                c.pages[0].ib = !0;
                                c.pages[1].ib = !0;
                                c.ia.trigger("onVisibilityChanged", c.la);
                                c.ga(c.da).animate({
                                    "margin-left": c.kf(!0)
                                }, {
                                    duration: 350,
                                    complete: function() {
                                        setTimeout(function() {
                                            c.aa.Mc = !1;
                                            c.ag(c.aa.ua + 2);
                                        }, 500);
                                    }
                                });
                            }, 500);
                        }
                    })) : c.ag(c.aa.ua + 2);
                }
            },
            Ne: function(c) {
                this.aa.ca && this.aa.ba == this.aa.ca.na && this.aa.ca.pb.Ne(this, c);
            }
        };
        return f;
    }(),
    U = function() {
        function f(c, d, e, g, f, l) {
            this.ia = g;
            this.aa = f;
            this.pages = e;
            this.ab = 1000;
            this.Fa = this.ib = !1;
            this.ja = c;
            this.pageNumber = d;
            this.dimensions = l;
            this.selectors = {};
            this.jd = "data:image/gif;base64,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%3D";
            this.Rm = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAVVSURBVHjaxFdbSFxHGJ7djfdb1HgNpsV7iwQrYhWN5EmReHlqUEGqUcGHohBCMSqhqEgU8aWiqH0QBDGkAe2bF1ARMduKldqqsURFrVqtBo1uvOzu9P+n/znMWVfNWwc+zp455/zf/LdvZnXs8qGTrrbAwe2ASddrDdvOIfSEGwADQW9DagVYCGa6t9os4kpS5bdCgGSOCpqamj5PSUm5d+fOnS98fHyiHB0dg3U6HT8/P//r6Ojoj729PePy8vJIRkbGnLQQdh25johcADcBQYDQ4uLitNevX3eB4Q2r1coVbG1t8ZWVFS7PnZ6ewtTK856eniiypbskmuoDB4ArwBfwCSCmvr7+GzBiJIO8s7OTP3jwgLu6umqQnJzMW1pauMlkEuTg9eDo6Gg62bRLrHiIhLfQO0B8VVXVk83NzUU0Mjg4yKOioi6Q2eLu3bt8enpaEJ+cnBiHh4fTJY81QwmpLxEmpKWlPVpYWJjFj7u7u7mHh8e1hC4uLgLu7u68oaFBEIPng11dXdH2iJ0ohxjSeEDmy5cvf1I8vIpQIbKHtrY2Qfz27dvnxKGXSd2oaGIAaVB9Nbu7u3tQODw8PFxDkpiYyO/fv3+BICQkhJeWlnJfX191zsvLi6+vr4vigsKKt/XWm8KaDMiFghjAFba2tmoI4+Li1Cqtra1VjUdHR/ONjQ0x39HRoc47OzvzsrIyMT8zM1NJrSdI9XSDReSJC4iNjY3ABy9evNAk/vj4mEFxiN81NTXs6dOnLDQ0lI2MjLDg4GAx//79e8Y5F8AxMDDAgJRBxL609TQEiwfwFeBbWPXewcGB3fzl5OSobYHA95Tfr1694m5ubsJDGbOzs1jJS2Dbg0RHeOpAiUZvXSEvntvb2xovlZUPDQ2x3NxcdnZ2Ju6hyMS1v7+fFRUV/SdnBoMGkFfm4OBwmwjV8Cpy50RgIG0XCJUBYiHCKI/5+XlmsVjsSh3Ogw2drNt6W2Hf2dk5DgwMtGsAciO8hWiIe8wXDhASVllZafcbzDdEZlNWJr3tS4uLi+9A0MXLspcYSiQMCAhQQ/rw4UO1uKqrq1lJSYnGFoY3MjKSQfu9kef10naEW5NlfHx8Bx9kZWVpDODHMmFhYSED8WD5+fkqMWiw5pvU1FTm6enJlpaWfrXd7rBH7wG+BnwXExPzI1TwEe4icrMjsO8qKio4GBKVqgC2PF5XV8cjIiI08xMTExx3J2ivdFK9G3ZbBvB9Y2Pj79gGzc3NGlJsAdnoVYBQi1YyGo1dxKG2jIHE3pGu2DYukFcrSJ4P5Mx9dXWVzc3NqfnV6/XXnUZYQkIC6+vrY7BL/fzs2bNW2DywkE4ohdxAhPIpwenw8BALCj++CSt2MZvNbHJy8qNIsbh6e3vZ/v7+m/b29h9AGo0oaIBT6TShFXzAI1Q6DHNSUtIwkG1hmGC1PC8vj/v5+dkNZ2ZmJocThggpFM7s48ePn5DNIOJQZVBHgoCh9QL4AQLpRSzVW0FBQbfLy8s/Kygo+BTayA12DaxGBiIuVgyFx6CARJXCiWF/bGxsEmqhH3L5GzzeBRwAPqDmUJeopwblqOJFpwd/wi3ahdzh5BCUnZ0dAluff1hYmLe/vz+uHokO19bW/p6amvoTWukXqNhZmMa2+4cITURoUVpGUQmDzW7jI8GbKs+VomJQFI7yhEZRF98B9iUc0rMzmZBJfWOh1ZjooYWq7ZhW6y6RKt+YJdIjIjmgBRxJIbXYOx9x8tYsqYaFVmgiQwqhoySdVnpHITYR0QeaO7/s7PvRh23K+w0bUjMZP5Ngvu6w/b/8rfhXgAEAmJkyLSnsNQEAAAAASUVORK5CYII=";
            this.pa = "dummyPage_" + this.pageNumber + "_" + this.ja;
            this.page = "page_" + this.pageNumber + "_" + this.ja;
            this.Uc = "pageContainer_" + this.pageNumber + "_" + this.ja;
            this.lo = this.Uc + "_textLayer";
            this.Kg = "dummyPageCanvas_" + this.pageNumber + "_" + this.ja;
            this.Lg = "dummyPageCanvas2_" + this.pageNumber + "_" + this.ja;
            this.Zh = this.page + "_canvasOverlay";
            this.tc = "pageLoader_" + this.pageNumber + "_" + this.ja;
            this.Xk = this.Uc + "_textoverlay";
            this.ba = this.aa.ba;
            this.na = this.aa.ca ? this.aa.ca.na : "";
            this.renderer = this.aa.renderer;
            c = this.aa.scale;
            this.scale = c;
            this.ma = "#" + this.pa;
            this.Ka = "#" + this.page;
            this.Ia = "#" + this.Uc;
            this.Ub = "#" + this.lo;
            this.hi = "#" + this.Kg;
            this.ii = "#" + this.Lg;
            this.Ob = "#" + this.tc;
            this.Yi = "#" + this.Xk;
            this.Ba = {
                bottom: 3,
                top: 2,
                right: 0,
                left: 1,
                jb: 4,
                back: 5
            };
            this.$a = [];
            this.duration = 1.3;
            this.ko = 16777215;
            this.offset = this.force = 0;
        }
        f.prototype = {
            ga: function(c) {
                if (0 < c.indexOf("undefined")) {
                    return jQuery(null);
                }
                this.selectors || (this.selectors = {});
                this.selectors[c] || (this.selectors[c] = jQuery(c));
                return this.selectors[c];
            },
            show: function() {
                "TwoPage" != this.aa.ba && "BookView" != this.aa.ba && this.ga(this.Ka).removeClass("flowpaper_hidden");
            },
            Ee: function() {
                this.pages.jScrollPane && (!eb.browser.rb.Bb && this.pages.jScrollPane ? "SinglePage" == this.aa.ba ? 0 > this.ga(this.pages.da).width() - this.ga(this.Ia).width() ? (this.pages.jScrollPane.data("jsp").scrollToPercentX(0.5, !1), this.pages.jScrollPane.data("jsp").scrollToPercentY(0.5, !1)) : (this.pages.jScrollPane.data("jsp").scrollToPercentX(0, !1), this.pages.jScrollPane.data("jsp").scrollToPercentY(0, !1)) : this.pages.jScrollPane.data("jsp").scrollToPercentX(0, !1) : this.ga(this.Ia).parent().scrollTo && this.ga(this.Ia).parent().scrollTo({
                    left: "50%"
                }, 0, {
                    axis: "x"
                }));
            },
            create: function(c) {
                var d = this;
                if ("Portrait" == d.aa.ba && (c.append("<div class='flowpaper_page " + (d.aa.document.DisableOverflow ? "flowpaper_ppage" : "") + " " + (d.aa.document.DisableOverflow && d.pageNumber < d.aa.renderer.getNumPages() - 1 ? "ppage_break" : "ppage_none") + "' id='" + d.Uc + "' style='position:relative;" + (d.aa.document.DisableOverflow ? "max-height:100%;margin:0;padding:0;overflow:hidden;" : "") + "'><div id='" + d.pa + "' class='' style='z-index:11;" + d.getDimensions() + ";'></div></div>"), 0 < jQuery(d.aa.Cj).length)) {
                    var e = this.ab * this.scale;
                    jQuery(d.aa.Cj).append("<div id='" + d.Xk + "' class='flowpaper_page' style='position:relative;height:" + e + "px;width:100%;overflow:hidden;'></div>");
                }
                "SinglePage" == d.aa.ba && 0 == d.pageNumber && c.append("<div class='flowpaper_page' id='" + d.Uc + "' class='flowpaper_rescale' style='position:relative;'><div id='" + d.pa + "' class='' style='position:absolute;z-index:11;" + d.getDimensions() + "'></div></div>");
                if ("TwoPage" == d.aa.ba || "BookView" == d.aa.ba) {
                    0 == d.pageNumber && jQuery(c.children().get(0)).append("<div class='flowpaper_page' id='" + d.Uc + "_1' style='z-index:2;float:right;position:relative;'><div id='" + d.pa + "_1' class='flowpaper_hidden flowpaper_border' style='" + d.getDimensions() + ";float:right;'></div></div>"), 1 == d.pageNumber && jQuery(c.children().get(1)).append("<div class='flowpaper_page' id='" + d.Uc + "_2' style='position:relative;z-index:1;float:left;'><div id='" + d.pa + "_2' class='flowpaper_hidden flowpaper_border' style='" + d.getDimensions() + ";float:left'></div></div>");
                }
                "ThumbView" == d.aa.ba && (c.append("<div class='flowpaper_page' id='" + d.Uc + "' style='position:relative;" + (eb.browser.msie ? "clear:none;float:left;" : "display:inline-block;") + "'><div id=\"" + d.pa + '" class="flowpaper_page flowpaper_thumb flowpaper_border flowpaper_load_on_demand" style="margin-left:10px;' + d.getDimensions() + '"></div></div>'), jQuery(d.Ia).on("mousedown touchstart", function() {
                    d.aa.gotoPage(d.pageNumber + 1);
                }));
                d.aa.ba == d.na ? d.aa.ca.vc.create(d, c) : (d.aa.renderer.Jd(d), d.show(), d.height = d.ga(d.Ia).height(), d.Al());
            },
            On: function() {
                var c = this;
                if (c.aa.Ii && !eb.platform.mobilepreview) {
                    jQuery(c.Ia).on("mouseover, mousemove", function(d) {
                        if (!c.aa.jh || c.aa.jh.button != d.target) {
                            for (var e = jQuery(".popover"), g = d.target.getBoundingClientRect().right + 200 < window.innerWidth ? "right" : "left", f = 0; f < e.length; f++) {
                                e[f].remove();
                            }
                            c.aa.jh = c.aa.ca && c.aa.ca.Ta ? new Popover({
                                position: g,
                                button: d.target,
                                className: "left" == g ? "popover-pushright" : "popover-pushleft"
                            }) : new Popover({
                                position: g,
                                button: d.target
                            });
                            c.aa.jh.setContent(String.format('<div class="flowpaper-popover-content" style="height:40px"><span class="flowpaper-publisher-popover-label">Page {0}</span><div id="flowpaper-publisher-edit-section" class="flowpaper-publisher-edit-button" style="bottom:10px;width:107px;" onmousedown="window.parent.postMessage(\'EditPage:{0}\',\'*\');event.preventDefault();event.stopImmediatePropagation();return false;" onclick="event.preventDefault();event.stopImmediatePropagation();return false;" onmouseup="event.preventDefault();event.stopImmediatePropagation();return false;">Edit Page</div></div>', c.pageNumber + 1, ""));
                            c.aa.jh.render("open");
                        }
                    });
                }
            },
            wn: function() {
                if ("Portrait" == this.aa.ba || "SinglePage" == this.aa.ba) {
                    return this.Zh;
                }
                if ("TwoPage" == this.aa.ba || "BookView" == this.aa.ba) {
                    if (0 == this.pageNumber) {
                        return this.Zh + "_1";
                    }
                    if (1 == this.pageNumber) {
                        return this.Zh + "_2";
                    }
                }
            },
            gj: function(c) {
                this.ga(this.Yi).css({
                    top: c
                });
            },
            oc: function() {
                "Portrait" != this.aa.ba && "SinglePage" != this.aa.ba && this.aa.ba != this.na || this.ga("#" + this.tc).hide();
                if ("TwoPage" == this.aa.ba || "BookView" == this.aa.ba) {
                    0 == this.pageNumber && this.ga(this.Ob + "_1").hide(), 1 == this.pageNumber && this.ga(this.Ob + "_2").hide();
                }
            },
            vd: function() {
                var c = this;
                if ("Portrait" == c.aa.ba || "SinglePage" == c.aa.ba || c.aa.ba == c.na) {
                    c.ab = 1000;
                    if (0 < c.ga(c.Ob).length) {
                        return;
                    }
                    if (null === c.ye && c.aa.ba == c.na) {
                        c.ye = jQuery("<div class='flowpaper_pageLoader' style='position:absolute;left:50%;top:50%;'></div>"), c.ga(c.Ia).append(c.ye), c.ye.spin({
                            color: "#777"
                        }), c.Xg = setTimeout(function() {
                            c.ye.remove();
                        }, 1000);
                    } else {
                        var d = 0 < jQuery(c.Ia).length ? jQuery(c.Ia) : c.Vc;
                        d && d.find && 0 != d.length ? 0 == d.find("#" + c.tc).length && d.append("<img id='" + c.tc + "' src='" + c.jd + "' class='flowpaper_pageLoader'  style='position:absolute;left:50%;top:50%;height:8px;margin-left:" + (c.Lc() - 10) + "px;' />") : K("can't show loader, missing container for page " + c.pageNumber);
                    }
                }
                if ("TwoPage" == c.aa.ba || "BookView" == c.aa.ba) {
                    if (0 == c.pageNumber) {
                        if (0 < c.ga(c.Ob + "_1").length) {
                            c.ga(c.Ob + "_1").show();
                            return;
                        }
                        c.ga(c.ma + "_1").append("<img id='" + c.tc + "_1' src='" + c.jd + "' style='position:absolute;left:" + (c.Va() - 30) + "px;top:" + c.Za() / 2 + "px;' />");
                        c.ga(c.Ob + "_1").show();
                    }
                    1 == c.pageNumber && (0 < c.ga(c.Ob + "_2").length || c.ga(c.ma + "_2").append("<img id='" + c.tc + "_2' src='" + c.jd + "' style='position:absolute;left:" + (c.Va() / 2 - 10) + "px;top:" + c.Za() / 2 + "px;' />"), c.ga(c.Ob + "_2").show());
                }
            },
            Xa: function() {
                var c, d;
                d = this.Va();
                c = this.Za();
                var e = this.Lc();
                if ("Portrait" == this.aa.ba || "SinglePage" == this.aa.ba) {
                    this.ga(this.Ia).css({
                        height: c,
                        width: d,
                        "margin-left": e,
                        "margin-top": 0
                    }), this.ga(this.ma).css({
                        height: c,
                        width: d,
                        "margin-left": e
                    }), this.ga(this.Ka).css({
                        height: c,
                        width: d,
                        "margin-left": e
                    }), this.ga(this.hi).css({
                        height: c,
                        width: d
                    }), this.ga(this.ii).css({
                        height: c,
                        width: d
                    }), this.ga(this.Yi).css({
                        height: c,
                        width: d
                    }), this.ga(this.Ob).css({
                        "margin-left": e
                    }), jQuery(this.Ub).css({
                        height: c,
                        width: d,
                        "margin-left": e
                    }), this.aa.renderer.tb && (jQuery(".flowpaper_flipview_canvas_highres").css({
                        width: 0.25 * d,
                        height: 0.25 * c
                    }).show(), this.scale < this.Xf() ? this.aa.renderer.zc(this) : this.aa.renderer.Xc(this)), this.uf(this.scale, e);
                }
                if ("TwoPage" == this.aa.ba || "BookView" == this.aa.ba) {
                    this.ga(this.ma + "_1").css({
                        height: c,
                        width: d
                    }), this.ga(this.ma + "_2").css({
                        height: c,
                        width: d
                    }), this.ga(this.ma + "_1_textoverlay").css({
                        height: c,
                        width: d
                    }), this.ga(this.ma + "_2_textoverlay").css({
                        height: c,
                        width: d
                    }), this.ga(this.Ka).css({
                        height: c,
                        width: d
                    }), eb.browser.rb.Bb || (0 == this.pages.la ? this.pages.ga(this.pages.da).css({
                        height: c,
                        width: d
                    }) : this.pages.ga(this.pages.da).css({
                        height: c,
                        width: 2 * d
                    }), "TwoPage" == this.aa.ba && this.pages.ga(this.pages.da).css({
                        width: "100%"
                    })), eb.platform.touchdevice && 1 <= this.scale && this.pages.ga(this.pages.da).css({
                        width: 2 * d
                    }), eb.platform.touchdevice && ("TwoPage" == this.aa.ba && this.pages.ga(this.pages.da + "_2").css("left", this.pages.ga(this.pages.da + "_1").width() + e + 2), "BookView" == this.aa.ba && this.pages.ga(this.pages.da + "_2").css("left", this.pages.ga(this.pages.da + "_1").width() + e + 2));
                }
                if (this.aa.ba == this.na) {
                    var g = this.Mg() * this.ab,
                        f = this.Va() / g;
                    null != this.dimensions.ub && this.vb && this.aa.renderer.Ha && (f = this.pages.Fd / 2 / g);
                    this.aa.ba == this.na ? 1 == this.scale && this.uf(f, e) : this.uf(f, e);
                }
                this.height = c;
                this.width = d;
            },
            Xf: function() {
                return 1;
            },
            ic: function() {
                return "SinglePage" == this.aa.ba;
            },
            resize: function() {},
            Mg: function() {
                return this.dimensions.Ca / this.dimensions.Na;
            },
            ge: function() {
                return this.aa.ba == this.na ? this.aa.ca.vc.ge(this) : this.dimensions.Ca / this.dimensions.Na * this.scale * this.ab;
            },
            hf: function() {
                return this.aa.ba == this.na ? this.aa.ca.vc.hf(this) : this.ab * this.scale;
            },
            getDimensions: function() {
                var c = this.jf(),
                    d = this.aa.ge();
                if (this.aa.document.DisableOverflow) {
                    var e = this.ab * this.scale;
                    return "height:" + e + "px;width:" + e * c + "px";
                }
                if ("Portrait" == this.aa.ba || "SinglePage" == this.aa.ba) {
                    return e = this.ab * this.scale, "height:" + e + "px;width:" + e * c + "px;margin-left:" + (d - e * c) / 2 + "px;";
                }
                if (this.aa.ba == this.na) {
                    return this.aa.ca.vc.getDimensions(this, c);
                }
                if ("TwoPage" == this.aa.ba || "BookView" == this.aa.ba) {
                    return e = this.ia.width() / 2 * this.scale, (0 == this.pageNumber ? "margin-left:0px;" : "") + "height:" + e + "px;width:" + e * c + "px";
                }
                if ("ThumbView" == this.aa.ba) {
                    return e = this.ab * ((this.ia.height() - 100) / this.ab) / 2.7, "height:" + e + "px;width:" + e * c + "px";
                }
            },
            jf: function() {
                return this.dimensions.Ca / this.dimensions.Na;
            },
            Va: function() {
                return this.aa.ba == this.na ? this.aa.ca.vc.Va(this) : this.ab * this.jf() * this.scale;
            },
            zi: function() {
                return this.aa.ba == this.na ? this.aa.ca.vc.zi(this) : this.ab * this.jf() * this.scale;
            },
            uk: function(c) {
                return c / (this.ab * this.jf());
            },
            Bi: function() {
                return this.aa.ba == this.na ? this.aa.ca.vc.Bi(this) : this.ab * this.jf();
            },
            Za: function() {
                return this.aa.ba == this.na ? this.aa.ca.vc.Za(this) : this.ab * this.scale;
            },
            yi: function() {
                return this.aa.ba == this.na ? this.aa.ca.vc.yi(this) : this.ab * this.scale;
            },
            Lc: function() {
                var c = this.aa.ge(),
                    d = 0;
                if (this.aa.document.DisableOverflow) {
                    return 0;
                }
                if ("Portrait" == this.aa.ba || "SinglePage" == this.aa.ba) {
                    return d = (c - this.Va()) / 2 / 2 - 4, 0 < d ? d : 0;
                }
                if ("TwoPage" == this.aa.ba || "BookView" == this.aa.ba) {
                    return 0;
                }
                if (this.aa.ba == this.na) {
                    return this.aa.ca.vc.Lc(this);
                }
            },
            Nc: function(c, d, e) {
                var g = !1;
                if ("Portrait" == this.aa.ba || "ThumbView" == this.aa.ba) {
                    if (this.offset = this.ga(this.Ia).offset()) {
                        this.pages.Bj || (this.pages.Bj = this.aa.ka.offset().top);
                        var g = this.offset.top - this.pages.Bj + c,
                            f = this.offset.top + this.height;
                        d = c + d;
                        g = e || eb.platform.touchdevice && !eb.browser.rb.Bb ? this.ib = c - this.height <= g && d >= g || g - this.height <= c && f >= d : c <= g && d >= g || g <= c && f >= d;
                    } else {
                        g = !1;
                    }
                }
                "SinglePage" == this.aa.ba && (g = this.ib = 0 == this.pageNumber);
                this.aa.ba == this.na && (g = this.ib = this.aa.ca.vc.Nc(this));
                if ("BookView" == this.aa.ba) {
                    if (0 == this.pages.getTotalPages() % 2 && this.pages.la >= this.pages.getTotalPages() && 1 == this.pageNumber) {
                        return !1;
                    }
                    g = this.ib = 0 == this.pageNumber || 0 != this.pages.la && 1 == this.pageNumber;
                }
                if ("TwoPage" == this.aa.ba) {
                    if (0 != this.pages.getTotalPages() % 2 && this.pages.la >= this.pages.getTotalPages() && 1 == this.pageNumber) {
                        return !1;
                    }
                    g = this.ib = 0 == this.pageNumber || 1 == this.pageNumber;
                }
                return g;
            },
            Xn: function() {
                this.Fa || this.load();
            },
            load: function(c) {
                this.La(c);
                if (!this.Fa) {
                    "TwoPage" == this.aa.ba && (c = this.aa.renderer.getDimensions(this.pageNumber - 1, this.pageNumber - 1)[this.pages.la + this.pageNumber], c.width != this.dimensions.width || c.height != this.dimensions.height) && (this.dimensions = c, this.Xa());
                    "BookView" == this.aa.ba && (c = this.aa.renderer.getDimensions(this.pageNumber - 1, this.pageNumber - 1)[this.pages.la - (0 < this.pages.la ? 1 : 0) + this.pageNumber], c.width != this.dimensions.width || c.height != this.dimensions.height) && (this.dimensions = c, this.Xa());
                    if ("SinglePage" == this.aa.ba) {
                        c = this.aa.renderer.getDimensions(this.pageNumber - 1, this.pageNumber - 1)[this.pages.la];
                        if (c.width != this.dimensions.width || c.height != this.dimensions.height) {
                            this.dimensions = c, this.Xa(), jQuery(".flowpaper_pageword_" + this.ja).remove(), this.La();
                        }
                        this.dimensions.loaded = !1;
                    }
                    "Portrait" == this.aa.ba && (c = this.aa.renderer.getDimensions(this.pageNumber - 1, this.pageNumber - 1)[this.pageNumber], c.width != this.dimensions.width || c.height != this.dimensions.height) && (this.dimensions = c, this.Xa(), jQuery(".flowpaper_pageword_" + this.ja).remove(), this.La());
                    this.aa.renderer.Pb(this, !1);
                    "function" === typeof this.Ci && this.loadOverlay();
                }
            },
            unload: function() {
                if (this.Fa || "TwoPage" == this.aa.ba || "BookView" == this.aa.ba || this.aa.ba == this.na) {
                    delete this.selectors, this.selectors = {}, jQuery(this.va).unbind(), delete this.va, this.va = null, this.Fa = !1, this.aa.renderer.unload(this), jQuery(this.Ob).remove(), this.ye && (delete this.ye, this.ye = null), this.aa.ba == this.na && this.aa.ca.vc.unload(this), "TwoPage" != this.aa.ba && "BookView" != this.aa.ba && this.ga("#" + this.wn()).remove(), "function" === typeof this.Ci && this.Rr();
                }
            },
            La: function(c) {
                "ThumbView" == this.aa.ba || !this.ib && null == c || this.pages.animating || this.aa.renderer.La(this, !1, c);
            },
            xc: function(c, d) {
                this.aa.renderer.xc(this, c, d);
            },
            Ce: function(c, d, e) {
                this.aa.renderer.Ce(this, c, d, e);
            },
            Al: function() {
                if ("Portrait" == this.aa.ba || "SinglePage" == this.aa.ba) {
                    eb.browser.msie && 9 > eb.browser.version || eb.platform.ios || (new aa(this.aa, "CanvasPageRenderer" == this.renderer.lf() ? this.ma : this.Ka, this.ga(this.Ia).parent())).scroll();
                }
            },
            uf: function(c, d) {
                var e = this;
                if (e.aa.Aa[e.pageNumber]) {
                    for (var g = 0; g < e.aa.Aa[e.pageNumber].length; g++) {
                        if ("link" == e.aa.Aa[e.pageNumber][g].type) {
                            var f = e.aa.Aa[e.pageNumber][g].Un * c,
                                l = e.aa.Aa[e.pageNumber][g].Vn * c,
                                k = e.aa.Aa[e.pageNumber][g].width * c,
                                m = e.aa.Aa[e.pageNumber][g].height * c;
                            if (0 == jQuery("#flowpaper_mark_link_" + e.pageNumber + "_" + g).length) {
                                var n = jQuery(String.format("<div id='flowpaper_mark_link_{4}_{5}' class='flowpaper_mark_link flowpaper_mark' style='left:{0}px;top:{1}px;width:{2}px;height:{3}px;box-shadow: 0px 0px 0px 0px;'></div>", f, l, k, m, e.pageNumber, g)),
                                    m = e.Ia;
                                0 == jQuery(m).length && (m = e.Vc);
                                n = jQuery(m).append(n).find("#flowpaper_mark_link_" + e.pageNumber + "_" + g);
                                n.data("link", e.aa.Aa[e.pageNumber][g].href);
                                n.bind("mousedown touchstart", function(c) {
                                    if (0 == jQuery(this).data("link").indexOf("actionGoTo:")) {
                                        e.aa.gotoPage(jQuery(this).data("link").substr(11));
                                    } else {
                                        if (0 == jQuery(this).data("link").indexOf("javascript")) {
                                            var d = unescape(jQuery(this).data("link"));
                                            eval(d.substring(11));
                                        } else {
                                            jQuery(e.ia).trigger("onExternalLinkClicked", jQuery(this).data("link"));
                                        }
                                    }
                                    c.preventDefault();
                                    c.stopImmediatePropagation();
                                    return !1;
                                });
                                eb.platform.touchonlydevice || (jQuery(n).on("mouseover", function() {
                                    jQuery(this).stop(!0, !0);
                                    jQuery(this).css("background", e.aa.linkColor);
                                    jQuery(this).css({
                                        opacity: e.aa.ke
                                    });
                                }), jQuery(n).on("mouseout", function() {
                                    jQuery(this).css("background", "");
                                    jQuery(this).css({
                                        opacity: 0
                                    });
                                }));
                            } else {
                                n = jQuery("#flowpaper_mark_link_" + e.pageNumber + "_" + g), n.css({
                                    left: f + "px",
                                    top: l + "px",
                                    width: k + "px",
                                    height: m + "px",
                                    "margin-left": d + "px"
                                });
                            }
                        }
                        if ("video" == e.aa.Aa[e.pageNumber][g].type) {
                            if (l = e.aa.Aa[e.pageNumber][g].Tl * c, k = e.aa.Aa[e.pageNumber][g].Ul * c, n = e.aa.Aa[e.pageNumber][g].width * c, f = e.aa.Aa[e.pageNumber][g].height * c, m = e.aa.Aa[e.pageNumber][g].src, 0 == jQuery("#flowpaper_mark_video_" + e.pageNumber + "_" + g).length) {
                                var u = jQuery(String.format("<div id='flowpaper_mark_video_{4}_{5}' class='flowpaper_mark_video flowpaper_mark' style='left:{0}px;top:{1}px;width:{2}px;height:{3}px;margin-left:{7}px'><img src='{6}' style='width:{2}px;height:{3}px;' class='flowpaper_mark'/></div>", l, k, n, f, e.pageNumber, g, m, d)),
                                    m = e.Ia;
                                0 == jQuery(m).length && (m = e.Vc);
                                n = jQuery(m).append(u).find("#flowpaper_mark_video_" + e.pageNumber + "_" + g);
                                n.data("video", e.aa.Aa[e.pageNumber][g].url);
                                n.data("maximizevideo", e.aa.Aa[e.pageNumber][g].bo);
                                n.bind("mousedown touchstart", function(c) {
                                    var d = jQuery(this).data("video"),
                                        g = "true" == jQuery(this).data("maximizevideo");
                                    if (d && 0 <= d.toLowerCase().indexOf("youtube")) {
                                        for (var f = d.substr(d.indexOf("?") + 1).split("&"), h = "", l = 0; l < f.length; l++) {
                                            0 == f[l].indexOf("v=") && (h = f[l].substr(2));
                                        }
                                        g ? (e.aa.nd = jQuery(String.format('<div class="flowpaper_mark_video_maximized flowpaper_mark" style="position:absolute;z-index:99999;left:2.5%;top:2.5%;width:95%;height:95%"></div>')), e.aa.ka.append(e.aa.nd), jQuery(e.aa.nd).html(String.format("<iframe width='{0}' height='{1}' src='{3}://www.youtube.com/embed/{2}?rel=0&autoplay=1&enablejsapi=1' frameborder='0' allowfullscreen ></iframe>", 0.95 * e.aa.ka.width(), 0.95 * e.aa.ka.height(), h, -1 < location.href.indexOf("https:") ? "https" : "http")), f = jQuery(String.format('<img class="flowpaper_mark_video_maximized_closebutton" src="{0}" style="position:absolute;left:97%;top:1%;z-index:999999;cursor:pointer;">', e.Rm)), e.aa.ka.append(f), jQuery(f).bind("mousedown touchstart", function() {
                                            jQuery(".flowpaper_mark_video_maximized").remove();
                                            jQuery(".flowpaper_mark_video_maximized_closebutton").remove();
                                        })) : jQuery(this).html(String.format("<iframe width='{0}' height='{1}' src='{3}://www.youtube.com/embed/{2}?rel=0&autoplay=1&enablejsapi=1' frameborder='0' allowfullscreen ></iframe>", jQuery(this).width(), jQuery(this).height(), h, -1 < location.href.indexOf("https:") ? "https" : "http"));
                                    }
                                    d && 0 <= d.toLowerCase().indexOf("vimeo") && (h = d.substr(d.lastIndexOf("/") + 1), g ? (jQuery(this).html(""), e.aa.nd = jQuery(String.format('<div class="flowpaper_mark_video_maximized flowpaper_mark" style="position:absolute;z-index:99999;left:2.5%;top:2.5%;width:95%;height:95%"></div>')), e.aa.ka.append(e.aa.nd), jQuery(e.aa.nd).html(String.format("<iframe src='//player.vimeo.com/video/{2}?autoplay=1' width='{0}' height='{1}' frameborder='0' webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>", 0.95 * e.aa.ka.width(), 0.95 * e.aa.ka.height(), h))) : jQuery(this).html(String.format("<iframe src='//player.vimeo.com/video/{2}?autoplay=1' width='{0}' height='{1}' frameborder='0' webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>", jQuery(this).width(), jQuery(this).height(), h)));
                                    if (d && -1 < d.indexOf("{")) {
                                        try {
                                            var k = JSON.parse(d),
                                                m = "vimeoframe_" + FLOWPAPER.un();
                                            g ? (jQuery(this).html(""), e.aa.nd = jQuery(String.format('<div class="flowpaper_mark_video_maximized flowpaper_mark" style="position:absolute;z-index:99999;left:2.5%;top:2.5%;width:95%;height:95%"></div>')), e.aa.ka.append(e.aa.nd), jQuery(e.aa.nd).html(jQuery(String.format('<video id="{2}" style="width:{3}px;height:{4}px;" class="videoframe flowpaper_mark video-js vjs-default-skin" controls autoplay preload="auto" width="{3}" height="{4}" data-setup=\'{"example_option":true}\'><source src="{0}" type="video/mp4" /><source src="{1}" type="video/webm" /></video>', k.mp4, k.webm, m, 0.95 * e.aa.ka.width(), 0.95 * e.aa.ka.height())))) : jQuery(this).html(jQuery(String.format('<video id="{2}" style="width:{3}px;height:{4}px;" class="videoframe flowpaper_mark video-js vjs-default-skin" controls autoplay preload="auto" width="{3}" height="{4}" data-setup=\'{"example_option":true}\'><source src="{0}" type="video/mp4" /><source src="{1}" type="video/webm" /></video>', k.mp4, k.webm, m, jQuery(this).width(), jQuery(this).height())));
                                        } catch (n) {}
                                    }
                                    c.preventDefault();
                                    c.stopImmediatePropagation();
                                    return !1;
                                });
                            } else {
                                u = jQuery("#flowpaper_mark_video_" + e.pageNumber + "_" + g), u.css({
                                    left: l + "px",
                                    top: k + "px",
                                    width: n + "px",
                                    height: f + "px",
                                    "margin-left": d + "px"
                                }).find(".flowpaper_mark").css({
                                    width: n + "px",
                                    height: f + "px"
                                }), l = u.find("iframe"), 0 < l.length && (l.attr("width", n), l.attr("height", f));
                            }
                        }
                        if ("image" == e.aa.Aa[e.pageNumber][g].type) {
                            var m = e.aa.Aa[e.pageNumber][g].Di * c,
                                u = e.aa.Aa[e.pageNumber][g].Ei * c,
                                v = e.aa.Aa[e.pageNumber][g].width * c,
                                p = e.aa.Aa[e.pageNumber][g].height * c,
                                n = e.aa.Aa[e.pageNumber][g].src,
                                f = e.aa.Aa[e.pageNumber][g].href,
                                l = e.aa.Aa[e.pageNumber][g].Jn;
                            0 == jQuery("#flowpaper_mark_image_" + e.pageNumber + "_" + g).length ? (k = jQuery(String.format("<div id='flowpaper_mark_image_{4}_{5}' class='flowpaper_mark_image flowpaper_mark' style='left:{0}px;top:{1}px;width:{2}px;height:{3}px;'><img src='{6}' style='width:{2}px;height:{3}px;' class='flowpaper_mark'/></div>", m, u, v, p, e.pageNumber, g, n)), m = e.Ia, 0 == jQuery(m).length && (m = e.Vc), m = jQuery(m).append(k).find("#flowpaper_mark_image_" + e.pageNumber + "_" + g), m.data("image", e.aa.Aa[e.pageNumber][g].url), null != f && 0 < f.length ? (m.data("link", f), m.bind("mousedown touchstart", function(c) {
                                0 == jQuery(this).data("link").indexOf("actionGoTo:") ? e.aa.gotoPage(jQuery(this).data("link").substr(11)) : jQuery(e.ia).trigger("onExternalLinkClicked", jQuery(this).data("link"));
                                c.preventDefault();
                                c.stopImmediatePropagation();
                                return !1;
                            })) : e.aa.Ii || k.css({
                                "pointer-events": "none"
                            }), null != l && 0 < l.length && (m.data("hoversrc", l), m.data("imagesrc", n), m.bind("mouseover", function() {
                                jQuery(this).find(".flowpaper_mark").attr("src", jQuery(this).data("hoversrc"));
                            }), m.bind("mouseout", function() {
                                jQuery(this).find(".flowpaper_mark").attr("src", jQuery(this).data("imagesrc"));
                            }))) : (k = jQuery("#flowpaper_mark_image_" + e.pageNumber + "_" + g), k.css({
                                left: m + "px",
                                top: u + "px",
                                width: v + "px",
                                height: p + "px",
                                "margin-left": d + "px"
                            }).find(".flowpaper_mark").css({
                                width: v + "px",
                                height: p + "px"
                            }));
                        }
                    }
                }
            },
            dispose: function() {
                jQuery(this.Ia).find("*").unbind();
                jQuery(this).unbind();
                jQuery(this.va).unbind();
                delete this.va;
                this.va = null;
                jQuery(this.Ia).find("*").remove();
                this.selectors = this.pages = this.aa = this.ia = null;
            },
            rotate: function() {
                this.rotation && 360 != this.rotation || (this.rotation = 0);
                this.rotation = this.rotation + 90;
                360 == this.rotation && (this.rotation = 0);
                var c = this.Lc();
                if ("Portrait" == this.aa.ba || "SinglePage" == this.aa.ba) {
                    this.Xa(), 90 == this.rotation ? (this.ga(this.ma).transition({
                        rotate: this.rotation
                    }, 0), jQuery(this.Ub).css({
                        "z-index": 11,
                        "margin-left": c
                    }), jQuery(this.Ub).transition({
                        rotate: this.rotation,
                        translate: "-" + c + "px, 0px"
                    }, 0)) : 270 == this.rotation ? (jQuery(this.Ub).css({
                        "z-index": 11,
                        "margin-left": c
                    }), this.ga(this.ma).transition({
                        rotate: this.rotation
                    }, 0), jQuery(this.Ub).transition({
                        rotate: this.rotation,
                        translate: "-" + c + "px, 0px"
                    }, 0)) : 180 == this.rotation ? (jQuery(this.Ub).css({
                        "z-index": 11,
                        "margin-left": c
                    }), this.ga(this.ma).transition({
                        rotate: this.rotation
                    }, 0), jQuery(this.Ub).transition({
                        rotate: this.rotation,
                        translate: "-" + c + "px, 0px"
                    }, 0)) : (jQuery(this.Ub).css({
                        "z-index": "",
                        "margin-left": 0
                    }), this.ga(this.ma).css("transform", ""), jQuery(this.Ub).css("transform", ""));
                }
            }
        };
        return f;
    }();

function ia(f, c) {
    this.aa = this.ra = f;
    this.ia = this.aa.ia;
    this.resources = this.aa.resources;
    this.ja = this.aa.ja;
    this.document = c;
    this.Xe = null;
    this.Ya = "toolbar_" + this.aa.ja;
    this.ea = "#" + this.Ya;
    this.ck = this.Ya + "_bttnPrintdialogPrint";
    this.Sh = this.Ya + "_bttnPrintdialogCancel";
    this.$j = this.Ya + "_bttnPrintDialog_RangeAll";
    this.ak = this.Ya + "_bttnPrintDialog_RangeCurrent";
    this.bk = this.Ya + "_bttnPrintDialog_RangeSpecific";
    this.Ph = this.Ya + "_bttnPrintDialogRangeText";
    this.Pk = this.Ya + "_labelPrintProgress";
    this.ji = null;
    this.create = function() {
        var c = this;
        c.Cl = "";
        if (eb.platform.touchonlydevice || c.ji) {
            c.ji || (e = c.resources.xa.$p, jQuery(c.ea).html((eb.platform.touchonlydevice ? "" : String.format("<img src='{0}' class='flowpaper_tbbutton_large flowpaper_print flowpaper_bttnPrint' style='margin-left:5px;'/>", c.resources.xa.mq)) + (c.aa.config.document.ViewModeToolsVisible ? (eb.platform.Ib ? "" : String.format("<img src='{0}' class='flowpaper_tbbutton_large flowpaper_viewmode flowpaper_singlepage {1} flowpaper_bttnSinglePage' style='margin-left:15px;'>", c.resources.xa.nq, "Portrait" == c.aa.Gb ? "flowpaper_tbbutton_pressed" : "")) + (eb.platform.Ib ? "" : String.format("<img src='{0}' style='margin-left:-1px;' class='flowpaper_tbbutton_large flowpaper_viewmode  flowpaper_twopage {1} flowpaper_bttnTwoPage'>", c.resources.xa.uq, "TwoPage" == c.aa.Gb ? "flowpaper_tbbutton_pressed" : "")) + (eb.platform.Ib ? "" : String.format("<img src='{0}' style='margin-left:-1px;' class='flowpaper_tbbutton_large flowpaper_viewmode flowpaper_thumbview flowpaper_bttnThumbView'>", c.resources.xa.tq)) + (eb.platform.Ib ? "" : String.format("<img src='{0}' style='margin-left:-1px;' class='flowpaper_tbbutton_large flowpaper_fitmode flowpaper_fitwidth flowpaper_bttnFitWidth'>", c.resources.xa.bq)) + (eb.platform.Ib ? "" : String.format("<img src='{0}' style='margin-left:-1px;' class='flowpaper_tbbutton_large flowpaper_fitmode fitheight flowpaper_bttnFitHeight'>", c.resources.xa.kq)) + "" : "") + (c.aa.config.document.ZoomToolsVisible ? String.format("<img class='flowpaper_tbbutton_large flowpaper_bttnZoomIn' src='{0}' style='margin-left:5px;' />", c.resources.xa.wq) + String.format("<img class='flowpaper_tbbutton_large flowpaper_bttnZoomOut' src='{0}' style='margin-left:-1px;' />", c.resources.xa.xq) + (eb.platform.Ib ? "" : String.format("<img class='flowpaper_tbbutton_large flowpaper_bttnFullScreen' src='{0}' style='margin-left:-1px;' />", c.resources.xa.fq)) + "" : "") + (c.aa.config.document.NavToolsVisible ? String.format("<img src='{0}' class='flowpaper_tbbutton_large flowpaper_previous flowpaper_bttnPrevPage' style='margin-left:15px;'/>", c.resources.xa.Qp) + String.format("<input type='text' class='flowpaper_tbtextinput_large flowpaper_currPageNum flowpaper_txtPageNumber' value='1' style='width:70px;text-align:right;' />") + String.format("<div class='flowpaper_tblabel_large flowpaper_numberOfPages flowpaper_lblTotalPages'> / </div>") + String.format("<img src='{0}'  class='flowpaper_tbbutton_large flowpaper_next flowpaper_bttnPrevNext'/>", c.resources.xa.Rp) + "" : "") + (c.aa.config.document.SearchToolsVisible ? String.format("<input type='text' class='flowpaper_tbtextinput_large flowpaper_txtSearch' style='margin-left:15px;width:130px;' />") + String.format("<img src='{0}' class='flowpaper_find flowpaper_tbbutton_large flowpaper_bttnFind' style=''/>", c.resources.xa.aq) + "" : "")), jQuery(c.ea).addClass("flowpaper_toolbarios"));
        } else {
            var e = c.resources.xa.$l,
                g = String.format("<div class='flowpaper_floatright flowpaper_bttnPercent' sbttnPrintIdtyle='text-align:center;padding-top:5px;background-repeat:no-repeat;width:20px;height:20px;font-size:9px;font-family:Arial;background-image:url({0})'><div id='lblPercent'></div></div>", c.resources.xa.rm);
            eb.browser.msie && addCSSRule(".flowpaper_tbtextinput", "height", "18px");
            jQuery(c.ea).html(String.format("<img src='{0}' class='flowpaper_tbbutton print flowpaper_bttnPrint'/>", c.resources.xa.nm) + String.format("<img src='{0}' class='flowpaper_tbseparator' />", e) + (c.aa.config.document.ViewModeToolsVisible ? String.format("<img src='{1}' class='flowpaper_bttnSinglePage flowpaper_tbbutton flowpaper_viewmode flowpaper_singlepage {0}' />", "Portrait" == c.aa.Gb ? "flowpaper_tbbutton_pressed" : "", c.resources.xa.qm) + String.format("<img src='{1}' class='flowpaper_bttnTwoPage flowpaper_tbbutton flowpaper_viewmode flowpaper_twopage {0}' />", "TwoPage" == c.aa.Gb ? "flowpaper_tbbutton_pressed" : "", c.resources.xa.um) + String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_thumbview flowpaper_viewmode flowpaper_bttnThumbView' />", c.resources.xa.tm) + String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_fitmode flowpaper_fitwidth flowpaper_bttnFitWidth' />", c.resources.xa.mm) + String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_fitmode flowpaper_fitheight flowpaper_bttnFitHeight'/>", c.resources.xa.lm) + String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_bttnRotate'/>", c.resources.xa.pm) + String.format("<img src='{0}' class='flowpaper_tbseparator' />", e) : "") + (c.aa.config.document.ZoomToolsVisible ? String.format("<div class='flowpaper_slider flowpaper_zoomSlider' style='{0}'><div class='flowpaper_handle' style='{0}'></div></div>", eb.browser.msie && 9 > eb.browser.version ? c.Cl : "") + String.format("<input type='text' class='flowpaper_tbtextinput flowpaper_txtZoomFactor' style='width:40px;' />") + String.format("<img class='flowpaper_tbbutton flowpaper_bttnFullScreen' src='{0}' />", c.resources.xa.em) + String.format("<img src='{0}' class='flowpaper_tbseparator' style='margin-left:5px' />", e) : "") + (c.aa.config.document.NavToolsVisible ? String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_previous flowpaper_bttnPrevPage'/>", c.resources.xa.Xl) + String.format("<input type='text' class='flowpaper_tbtextinput flowpaper_currPageNum flowpaper_txtPageNumber' value='1' style='width:50px;text-align:right;' />") + String.format("<div class='flowpaper_tblabel flowpaper_numberOfPages flowpaper_lblTotalPages'> / </div>") + String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_next flowpaper_bttnPrevNext'/>", c.resources.xa.Yl) + String.format("<img src='{0}' class='flowpaper_tbseparator' />", e) : "") + (c.aa.config.document.CursorToolsVisible ? String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_bttnTextSelect'/>", c.resources.xa.sm) + String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_tbbutton_pressed flowpaper_bttnHand'/>", c.resources.xa.gm) + String.format("<img src='{0}' class='flowpaper_tbseparator' />", e) : "") + (c.aa.config.document.SearchToolsVisible ? String.format("<input type='text' class='flowpaper_tbtextinput flowpaper_txtSearch' style='width:70px;margin-left:4px' />") + String.format("<img src='{0}' class='flowpaper_find flowpaper_tbbutton flowpaper_bttnFind' />", c.resources.xa.dm) + String.format("<img src='{0}' class='flowpaper_tbseparator' />", e) : "") + g);
            jQuery(c.ea).addClass("flowpaper_toolbarstd");
        }
        jQuery(c.ia).bind("onDocumentLoaded", function() {
            jQuery(c.ea).find(".flowpaper_bttnPercent").hide();
        });
    };
    this.Sk = function(c) {
        c = this.fb = c.split("\n");
        jQuery(this.ea).find(".flowpaper_bttnPrint").attr("title", this.Ga(c, "Print"));
        jQuery(this.ea).find(".flowpaper_bttnSinglePage").attr("title", this.Ga(c, "SinglePage"));
        jQuery(this.ea).find(".flowpaper_bttnTwoPage, .flowpaper_bttnBookView").attr("title", this.Ga(c, "TwoPage"));
        jQuery(this.ea).find(".flowpaper_bttnThumbView").attr("title", this.Ga(c, "ThumbView"));
        jQuery(this.ea).find(".flowpaper_bttnFitWidth").attr("title", this.Ga(c, "FitWidth"));
        jQuery(this.ea).find(".flowpaper_bttnFitHeight").attr("title", this.Ga(c, "FitHeight"));
        jQuery(this.ea).find(".flowpaper_bttnFitHeight").attr("title", this.Ga(c, "FitPage"));
        jQuery(this.ea).find(".flowpaper_zoomSlider").attr("title", this.Ga(c, "Scale"));
        jQuery(this.ea).find(".flowpaper_txtZoomFactor").attr("title", this.Ga(c, "Scale"));
        jQuery(this.ea).find(".flowpaper_bttnFullScreen, .flowpaper_bttnFullscreen").attr("title", this.Ga(c, "Fullscreen"));
        jQuery(this.ea).find(".flowpaper_bttnPrevPage").attr("title", this.Ga(c, "PreviousPage"));
        jQuery(this.ea).find(".flowpaper_txtPageNumber").attr("title", this.Ga(c, "CurrentPage"));
        jQuery(this.ea).find(".flowpaper_bttnPrevNext").attr("title", this.Ga(c, "NextPage"));
        jQuery(this.ea).find(".flowpaper_txtSearch, .flowpaper_bttnTextSearch").attr("title", this.Ga(c, "Search"));
        jQuery(this.ea).find(".flowpaper_bttnFind").attr("title", this.Ga(c, "Search"));
        var e = this.aa.Ye && 0 < this.aa.Ye.length ? this.aa.Ye : this.aa.ka;
        e.find(".flowpaper_bttnHighlight").find(".flowpaper_tbtextbutton").html(this.Ga(c, "Highlight", "Highlight"));
        e.find(".flowpaper_bttnComment").find(".flowpaper_tbtextbutton").html(this.Ga(c, "Comment", "Comment"));
        e.find(".flowpaper_bttnStrikeout").find(".flowpaper_tbtextbutton").html(this.Ga(c, "Strikeout", "Strikeout"));
        e.find(".flowpaper_bttnDraw").find(".flowpaper_tbtextbutton").html(this.Ga(c, "Draw", "Draw"));
        e.find(".flowpaper_bttnDelete").find(".flowpaper_tbtextbutton").html(this.Ga(c, "Delete", "Delete"));
        e.find(".flowpaper_bttnShowHide").find(".flowpaper_tbtextbutton").html(this.Ga(c, "ShowAnnotations", "Show Annotations"));
    };
    this.Ga = function(c, e, g) {
        for (var f = 0; f < c.length; f++) {
            var l = c[f].split("=");
            if (l[0] == e) {
                return l[1];
            }
        }
        return g ? g : null;
    };
    this.bindEvents = function() {
        var c = this;
        jQuery(c.ea).find(".flowpaper_tbbutton_large, .flowpaper_tbbutton").each(function() {
            jQuery(this).data("minscreenwidth") && parseInt(jQuery(this).data("minscreenwidth")) > window.innerWidth && jQuery(this).hide();
        });
        if (0 == c.aa.ka.find(".flowpaper_printdialog").length) {
            var e = c.Ga(c.fb, "Enterpagenumbers", "Enter page numbers and/or page ranges separated by commas. For example 1,3,5-12");
            c.aa.Ii ? c.aa.ka.prepend("<div id='modal-print' class='modal-content flowpaper_printdialog' style='overflow:hidden;;'><div style='background-color:#fff;color:#000;padding:10px 10px 10px 10px;height:205px;padding-bottom:20px;'>It's not possible to print from within Desktop Publisher. <br/><br/>You can try this feature by clicking on 'Publish' and then 'View in Browser'.<br/><br/><a class='flowpaper_printdialog_button' id='" + c.Sh + "'>OK</a></div></div>") : c.aa.ka.prepend("<div id='modal-print' class='modal-content flowpaper_printdialog' style='overflow:hidden;'><font style='color:#000000;font-size:11px'><b>" + c.Ga(c.fb, "Selectprintrange", "Select print range") + "</b></font><div style='width:98%;padding-top:5px;padding-left:5px;background-color:#ffffff;'><table border='0' style='margin-bottom:10px;'><tr><td><input type='radio' name='PrintRange' checked='checked' id='" + c.$j + "'/></td><td>" + c.Ga(c.fb, "All", "All") + "</td></tr><tr><td><input type='radio' name='PrintRange' id='" + c.ak + "'/></td><td>" + c.Ga(c.fb, "CurrentPage", "Current Page") + "</td></tr><tr><td><input type='radio' name='PrintRange' id='" + c.bk + "'/></td><td>" + c.Ga(c.fb, "Pages", "Pages") + "</td><td><input type='text' style='width:120px' id='" + c.Ph + "' /><td></tr><tr><td colspan='3'>" + e + "</td></tr></table><a id='" + c.ck + "' class='flowpaper_printdialog_button'>" + c.Ga(c.fb, "Print", "Print") + "</a>&nbsp;&nbsp;<a class='flowpaper_printdialog_button' id='" + c.Sh + "'>" + c.Ga(c.fb, "Cancel", "Cancel") + "</a><span id='" + c.Pk + "' style='padding-left:5px;'></span><div style='height:5px;display:block;margin-top:5px;'>&nbsp;</div></div></div>");
        }
        jQuery("input:radio[name=PrintRange]:nth(0)").attr("checked", !0);
        c.aa.config.Toolbar ? (jQuery(c.ea).find(".flowpaper_txtZoomFactor").bind("click", function() {
            if (!jQuery(this).hasClass("flowpaper_tbbutton_disabled")) {
                return !1;
            }
        }), jQuery(c.ea).find(".flowpaper_currPageNum").bind("click", function() {
            jQuery(c.ea).find(".flowpaper_currPageNum").focus();
        }), jQuery(c.ea).find(".flowpaper_txtSearch").bind("click", function() {
            jQuery(c.ea).find(".flowpaper_txtSearch").focus();
            return !1;
        }), jQuery(c.ea).find(".flowpaper_bttnFind").bind("click", function() {
            c.searchText(jQuery(c.ea).find(".flowpaper_txtSearch").val());
            jQuery(c.ea).find(".flowpaper_bttnFind").focus();
            return !1;
        })) : (jQuery(c.ea).find(".flowpaper_bttnFitWidth").bind("click", function() {
            jQuery(this).hasClass("flowpaper_tbbutton_disabled") || (c.aa.fitwidth(), jQuery("#toolbar").trigger("onFitModeChanged", "Fit Width"));
        }), jQuery(c.ea).find(".flowpaper_bttnFitHeight").bind("click", function() {
            jQuery(this).hasClass("flowpaper_tbbutton_disabled") || (c.aa.fitheight(), jQuery("#toolbar").trigger("onFitModeChanged", "Fit Height"));
        }), jQuery(c.ea).find(".flowpaper_bttnTwoPage").bind("click", function() {
            jQuery(this).hasClass("flowpaper_tbbutton_disabled") || ("BookView" == c.aa.Gb ? c.aa.switchMode("BookView") : c.aa.switchMode("TwoPage"));
        }), jQuery(c.ea).find(".flowpaper_bttnSinglePage").bind("click", function() {
            c.aa.config.document.TouchInitViewMode && "SinglePage" != !c.aa.config.document.TouchInitViewMode || !eb.platform.touchonlydevice ? c.aa.switchMode("Portrait", c.aa.getCurrPage() - 1) : c.aa.switchMode("SinglePage", c.aa.getCurrPage());
        }), jQuery(c.ea).find(".flowpaper_bttnThumbView").bind("click", function() {
            c.aa.switchMode("Tile");
        }), jQuery(c.ea).find(".flowpaper_bttnPrint").bind("click", function() {
            eb.platform.touchonlydevice ? c.aa.printPaper("current") : (jQuery("#modal-print").css("background-color", "#dedede"), c.aa.bj = jQuery("#modal-print").smodal({
                minHeight: 255,
                appendTo: c.aa.ka
            }), jQuery("#modal-print").parent().css("background-color", "#dedede"));
        }), /*
            jQuery(c.ea).find(".flowpaper_bttnDownload").bind("click", function() {
            window.zine ? (window.open(FLOWPAPER.yj(c.document.PDFFile, c.aa.getCurrPage()), "windowname3", null), 0 < c.document.PDFFile.indexOf("[*,") && -1 == c.document.PDFFile.indexOf("[*,2,true]") && 1 < c.aa.getTotalPages() && 1 < c.aa.getCurrPage() && window.open(FLOWPAPER.yj(c.document.PDFFile, c.aa.getCurrPage() - 1), "windowname4", null)) : window.open(FLOWPAPER.yj(c.document.PDFFile, c.aa.getCurrPage()), "windowname4", null);
            return !1;
            */
            // INIZIO CUSTOM EXPORT PDF SAVE
            jQuery(c.ea).find(".flowpaper_bttnDownload").bind("click", function() {
                var id_anagrafica = jQuery('#id_anagrafica').text();
                var doc = jQuery('#doc').text();
                jQuery.ajax({
                    method: "POST",
                    url: "downloader.php",
                    data: { id_anagrafica: id_anagrafica, doc: doc }
                })
                .done(function( msg ) {
                    var link=document.createElement('a');
                    //link.href=msg;
                    link.download=msg;
                    link.click();
                });
            return !1;
            // FINE CUSTOM EXPORT
        }), jQuery(c.ea).find(".flowpaper_bttnOutline").bind("click", function() {
            c.aa.hn();
        }), jQuery(c.ea).find(".flowpaper_bttnPrevPage").bind("click", function() {
            c.aa.previous();
            return !1;
        }), jQuery(c.ea).find(".flowpaper_bttnPrevNext").bind("click", function() {
            c.aa.next();
            return !1;
        }), jQuery(c.ea).find(".flowpaper_bttnZoomIn").bind("click", function() {
            "TwoPage" == c.aa.ba || "BookView" == c.aa.ba ? c.aa.pages.je() : "Portrait" != c.aa.ba && "SinglePage" != c.aa.ba || c.aa.ZoomIn();
        }), jQuery(c.ea).find(".flowpaper_bttnZoomOut").bind("click", function() {
            "TwoPage" == c.aa.ba || "BookView" == c.aa.ba ? c.aa.pages.fd() : "Portrait" != c.aa.ba && "SinglePage" != c.aa.ba || c.aa.ZoomOut();
        }), jQuery(c.ea).find(".flowpaper_txtZoomFactor").bind("click", function() {
            if (!jQuery(this).hasClass("flowpaper_tbbutton_disabled")) {
                return jQuery(c.ea).find(".flowpaper_txtZoomFactor").focus(), !1;
            }
        }), jQuery(c.ea).find(".flowpaper_currPageNum").bind("click", function() {
            jQuery(c.ea).find(".flowpaper_currPageNum").focus();
        }), jQuery(c.ea).find(".flowpaper_txtSearch").bind("click", function() {
            jQuery(c.ea).find(".flowpaper_txtSearch").focus();
            return !1;
        }), jQuery(c.ea).find(".flowpaper_bttnFullScreen, .flowpaper_bttnFullscreen").bind("click", function() {
            c.aa.openFullScreen();
        }), jQuery(c.ea).find(".flowpaper_bttnFind").bind("click", function() {
            c.searchText(jQuery(c.ea).find(".flowpaper_txtSearch").val());
            jQuery(c.ea).find(".flowpaper_bttnFind").focus();
            return !1;
        }), jQuery(c.ea).find(".flowpaper_bttnTextSelect").bind("click", function() {
            c.aa.ue = "flowpaper_selected_default";
            jQuery(c.ea).find(".flowpaper_bttnTextSelect").addClass("flowpaper_tbbutton_pressed");
            jQuery(c.ea).find(".flowpaper_bttnHand").removeClass("flowpaper_tbbutton_pressed");
            c.aa.setCurrentCursor("TextSelectorCursor");
        }), jQuery(c.ea).find(".flowpaper_bttnHand").bind("click", function() {
            jQuery(c.ea).find(".flowpaper_bttnHand").addClass("flowpaper_tbbutton_pressed");
            jQuery(c.ea).find(".flowpaper_bttnTextSelect").removeClass("flowpaper_tbbutton_pressed");
            c.aa.setCurrentCursor("ArrowCursor");
        }), jQuery(c.ea).find(".flowpaper_bttnRotate").bind("click", function() {
            c.aa.rotate();
        }));
        jQuery("#" + c.Ph).bind("keydown", function() {
            jQuery(this).focus();
        });
        jQuery(c.ea).find(".flowpaper_currPageNum, .flowpaper_txtPageNumber").bind("keydown", function(e) {
            if (!jQuery(this).hasClass("flowpaper_tbbutton_disabled")) {
                if ("13" != e.keyCode) {
                    return;
                }
                c.gotoPage(this);
            }
            return !1;
        });
        jQuery(c.ea).find(".flowpaper_txtSearch").bind("keydown", function(e) {
            if ("13" == e.keyCode) {
                return c.searchText(jQuery(c.ea).find(".flowpaper_txtSearch").val()), !1;
            }
        });
        jQuery(c.ea).bind("onZoomFactorChanged", function(e, f) {
            var l = Math.round(f.df / c.aa.document.MaxZoomSize * 100 * c.aa.document.MaxZoomSize) + "%";
            jQuery(c.ea).find(".flowpaper_txtZoomFactor").val(l);
            c.df != f.df && (c.df = f.df, jQuery(c.aa).trigger("onScaleChanged", f.df));
        });
        jQuery(c.ia).bind("onDocumentLoaded", function(e, f) {
            2 > f ? jQuery(c.ea).find(".flowpaper_bttnTwoPage").addClass("flowpaper_tbbutton_disabled") : jQuery(c.ea).find(".flowpaper_bttnTwoPage").removeClass("flowpaper_tbbutton_disabled");
        });
        jQuery(c.ea).bind("onCursorChanged", function(e, f) {
            "TextSelectorCursor" == f && (jQuery(c.ea).find(".flowpaper_bttnTextSelect").addClass("flowpaper_tbbutton_pressed"), jQuery(c.ea).find(".flowpaper_bttnHand").removeClass("flowpaper_tbbutton_pressed"));
            "ArrowCursor" == f && (jQuery(c.ea).find(".flowpaper_bttnHand").addClass("flowpaper_tbbutton_pressed"), jQuery(c.ea).find(".flowpaper_bttnTextSelect").removeClass("flowpaper_tbbutton_pressed"));
        });
        jQuery(c.ea).bind("onFitModeChanged", function(e, f) {
            jQuery(".flowpaper_fitmode").each(function() {
                jQuery(this).removeClass("flowpaper_tbbutton_pressed");
            });
            "FitHeight" == f && jQuery(c.ea).find(".flowpaper_bttnFitHeight").addClass("flowpaper_tbbutton_pressed");
            "FitWidth" == f && jQuery(c.ea).find(".flowpaper_bttnFitWidth").addClass("flowpaper_tbbutton_pressed");
        });
        jQuery(c.ea).bind("onProgressChanged", function(e, f) {
            jQuery("#lblPercent").html(100 * f);
            1 == f && jQuery(c.ea).find(".flowpaper_bttnPercent").hide();
        });
        jQuery(c.ea).bind("onViewModeChanged", function(e, f) {
            jQuery(c.ia).trigger("onViewModeChanged", f);
            jQuery(".flowpaper_viewmode").each(function() {
                jQuery(this).removeClass("flowpaper_tbbutton_pressed");
            });
            if ("Portrait" == c.aa.ba || "SinglePage" == c.aa.ba) {
                jQuery(c.ea).find(".flowpaper_bttnSinglePage").addClass("flowpaper_tbbutton_pressed"), jQuery(c.ea).find(".flowpaper_bttnFitWidth").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnFitHeight").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnPrevPage").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnPrevNext").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnTextSelect").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_zoomSlider").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_txtZoomFactor").removeClass("flowpaper_tbbutton_disabled"), c.aa.toolbar && c.aa.toolbar.Ec && c.aa.toolbar.Ec.enable();
            }
            if ("TwoPage" == c.aa.ba || "BookView" == c.aa.ba || "FlipView" == c.aa.ba) {
                jQuery(c.ea).find(".flowpaper_bttnBookView").addClass("flowpaper_tbbutton_pressed"), jQuery(c.ea).find(".flowpaper_bttnTwoPage").addClass("flowpaper_tbbutton_pressed"), jQuery(c.ea).find(".flowpaper_bttnFitWidth").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnFitHeight").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnPrevPage").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnPrevNext").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnTextSelect").removeClass("flowpaper_tbbutton_disabled"), eb.platform.touchdevice && (jQuery(c.ea).find(".flowpaper_zoomSlider").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_txtZoomFactor").addClass("flowpaper_tbbutton_disabled"), c.aa.toolbar.Ec && c.aa.toolbar.Ec.disable()), eb.platform.touchdevice || eb.browser.msie || (jQuery(c.ea).find(".flowpaper_zoomSlider").removeClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_txtZoomFactor").removeClass("flowpaper_tbbutton_disabled"), c.aa.toolbar.Ec && c.aa.toolbar.Ec.enable());
            }
            "ThumbView" == c.aa.ba && (jQuery(c.ea).find(".flowpaper_bttnThumbView").addClass("flowpaper_tbbutton_pressed"), jQuery(c.ea).find(".flowpaper_bttnFitWidth").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnFitHeight").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnPrevPage").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnPrevNext").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_bttnTextSelect").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_zoomSlider").addClass("flowpaper_tbbutton_disabled"), jQuery(c.ea).find(".flowpaper_txtZoomFactor").addClass("flowpaper_tbbutton_disabled"), c.aa.toolbar && c.aa.toolbar.Ec && c.aa.toolbar.Ec.disable());
        });
        jQuery(c.ea).bind("onFullscreenChanged", function(e, f) {
            f ? jQuery(c.ea).find(".flowpaper_bttnFullscreen").addClass("flowpaper_tbbutton_disabled") : jQuery(c.ea).find(".flowpaper_bttnFullscreen").removeClass("flowpaper_tbbutton_disabled");
        });
        jQuery(c.ea).bind("onScaleChanged", function(e, f) {
            jQuery(c.ia).trigger("onScaleChanged", f);
            c.Ec && c.Ec.setValue(f, !0);
        });
        jQuery("#" + c.Sh).bind("click", function(e) {
            jQuery.smodal.close();
            e.stopImmediatePropagation();
            c.aa.bj = null;
            return !1;
        });
        jQuery("#" + c.ck).bind("click", function() {
            var e = "";
            jQuery("#" + c.$j).is(":checked") && (c.aa.printPaper("all"), e = "1-" + c.aa.renderer.getNumPages());
            jQuery("#" + c.ak).is(":checked") && (c.aa.printPaper("current"), e = jQuery(c.ea).find(".flowpaper_txtPageNumber").val());
            jQuery("#" + c.bk).is(":checked") && (e = jQuery("#" + c.Ph).val(), c.aa.printPaper(e));
            jQuery(this).html("Please wait");
            window.onPrintRenderingProgress = function(e) {
                jQuery("#" + c.Pk).html("Processing page:" + e);
            };
            window.onPrintRenderingCompleted = function() {
                jQuery.smodal.close();
                c.aa.bj = null;
                c.ia.trigger("onDocumentPrinted", e);
            };
            return !1;
        });
        c.Gp();
    };
    this.Am = function(c, e) {
        var g = this;
        if (0 != jQuery(g.ea).find(".flowpaper_zoomSlider").length && null == g.Ec) {
            g = this;
            this.wf = c;
            this.vf = e;
            if (window.zine) {
                var f = {
                    Jf: 0,
                    jc: g.aa.ia.width() / 2,
                    Ic: g.aa.ia.height() / 2
                };
                g.Ec = new Slider(jQuery(g.ea).find(".flowpaper_zoomSlider").get(0), {
                    callback: function(c) {
                        c * g.aa.document.MaxZoomSize >= g.aa.document.MinZoomSize && c <= g.aa.document.MaxZoomSize ? g.aa.lb(g.aa.document.MaxZoomSize * c, f) : c * g.aa.document.MaxZoomSize < g.aa.document.MinZoomSize ? g.aa.lb(g.aa.document.MinZoomSize, f) : c > g.aa.document.MaxZoomSize && g.aa.lb(g.aa.document.MaxZoomSize, f);
                    },
                    animation_callback: function(c) {
                        c * g.aa.document.MaxZoomSize >= g.aa.document.MinZoomSize && c <= g.aa.document.MaxZoomSize ? g.aa.lb(g.aa.document.MaxZoomSize * c, f) : c * g.aa.document.MaxZoomSize < g.aa.document.MinZoomSize ? g.aa.lb(g.aa.document.MinZoomSize, f) : c > g.aa.document.MaxZoomSize && g.aa.lb(g.aa.document.MaxZoomSize, f);
                    },
                    snapping: !1
                });
            } else {
                jQuery(g.ea).find(".flowpaper_zoomSlider > *").bind("mousedown", function() {
                    jQuery(g.ea).find(".flowpaper_bttnFitWidth").removeClass("flowpaper_tbbutton_pressed");
                    jQuery(g.ea).find(".flowpaper_bttnFitHeight").removeClass("flowpaper_tbbutton_pressed");
                }), g.Ec = new Slider(jQuery(g.ea).find(".flowpaper_zoomSlider").get(0), {
                    callback: function(c) {
                        jQuery(g.ea).find(".flowpaper_bttnFitWidth, .flowpaper_bttnFitHeight").hasClass("flowpaper_tbbutton_pressed") && "up" === g.aa.fh || (c * g.aa.document.MaxZoomSize >= g.wf && c <= g.vf ? g.aa.lb(g.aa.document.MaxZoomSize * c) : c * g.aa.document.MaxZoomSize < g.wf ? g.aa.lb(g.wf) : c > g.vf && g.aa.lb(g.vf));
                    },
                    animation_callback: function(c) {
                        jQuery(g.ea).find(".flowpaper_bttnFitWidth, .flowpaper_bttnFitHeight").hasClass("flowpaper_tbbutton_pressed") && "up" === g.aa.fh || (c * g.aa.document.MaxZoomSize >= g.wf && c <= g.vf ? g.aa.lb(g.aa.document.MaxZoomSize * c) : c * g.aa.document.MaxZoomSize < g.wf ? g.aa.lb(g.wf) : c > g.vf && g.aa.lb(g.vf));
                    },
                    snapping: !1
                });
            }
            jQuery(g.ea).find(".flowpaper_txtZoomFactor").bind("keypress", function(c) {
                if (!jQuery(this).hasClass("flowpaper_tbbutton_disabled") && 13 == c.keyCode) {
                    try {
                        var d = {
                                Jf: 0,
                                jc: g.aa.ia.width() / 2,
                                Ic: g.aa.ia.height() / 2
                            },
                            e = jQuery(g.ea).find(".flowpaper_txtZoomFactor").val().replace("%", "") / 100;
                        g.aa.Zoom(e, d);
                    } catch (f) {}
                    return !1;
                }
            });
        }
    };
    this.Hp = function(c) {
        jQuery(c).val() > this.document.numPages && jQuery(c).val(this.document.numPages);
        (1 > jQuery(c).val() || isNaN(jQuery(c).val())) && jQuery(c).val(1);
    };
    this.Fp = function(c) {
        "TwoPage" == this.aa.ba ? "1" == c ? jQuery(this.ea).find(".flowpaper_txtPageNumber").val("1-2") : parseInt(c) <= this.document.numPages && 0 == this.document.numPages % 2 || parseInt(c) < this.document.numPages && 0 != this.document.numPages % 2 ? jQuery(this.ea).find(".flowpaper_txtPageNumber").val(c + "-" + (c + 1)) : jQuery(this.ea).find(".flowpaper_txtPageNumber").val(this.document.numPages) : "BookView" == this.aa.ba || "FlipView" == this.aa.ba ? "1" != c || eb.platform.iphone ? !(parseInt(c) + 1 <= this.document.numPages) || this.aa.ca && this.aa.ca.Ta ? jQuery(this.ea).find(".flowpaper_txtPageNumber").val(this.qh(c, c)) : (0 != parseInt(c) % 2 && 1 < parseInt(c) && (c = c - 1), jQuery(this.ea).find(".flowpaper_txtPageNumber").val(this.qh(c, 1 < parseInt(c) ? c + "-" + (c + 1) : c))) : jQuery(this.ea).find(".flowpaper_txtPageNumber").val(this.qh(1, "1")) : "0" != c && jQuery(this.ea).find(".flowpaper_txtPageNumber").val(this.qh(c, c));
    };
    this.Ho = function(c) {
        if (this.aa.labels) {
            for (var e = this.aa.labels.children(), g = 0; g < e.length; g++) {
                if (e[g].getAttribute("title") == c) {
                    return parseInt(e[g].getAttribute("pageNumber"));
                }
            }
        }
        return null;
    };
    this.qh = function(c, e) {
        0 == c && (c = 1);
        if (this.aa.labels) {
            var g = this.aa.labels.children();
            if (g.length > parseInt(c) - 1) {
                var f = g[parseInt(c - 1)].getAttribute("title");
                isNaN(f) ? e = unescape(g[parseInt(c) - 1].getAttribute("title")) : !("FlipView" == this.aa.ba && 1 < parseInt(f) && parseInt(f) + 1 <= this.document.numPages) || this.aa.ca && this.aa.ca.Ta ? e = f : (0 != parseInt(f) % 2 && (f = parseInt(f) - 1), e = f + "-" + (parseInt(f) + 1));
            }
        }
        return e;
    };
    this.Gp = function() {
        jQuery(this.ea).find(".flowpaper_lblTotalPages").html(" / " + this.document.numPages);
    };
    this.gotoPage = function(c) {
        var e = this.Ho(jQuery(c).val());
        e ? this.aa.gotoPage(e) : 0 <= jQuery(c).val().indexOf("-") && "TwoPage" == this.aa.ba ? (c = jQuery(c).val().split("-"), isNaN(c[0]) || isNaN(c[1]) || (0 == parseInt(c[0]) % 2 ? this.aa.gotoPage(parseInt(c[0]) - 1) : this.aa.gotoPage(parseInt(c[0])))) : isNaN(jQuery(c).val()) || (this.Hp(c), this.aa.gotoPage(jQuery(c).val()));
    };
    this.searchText = function(c) {
        this.aa.searchText(c);
    };
}
window.addCSSRule = function(f, c, d) {
    for (var e = null, g = 0; g < document.styleSheets.length; g++) {
        try {
            var h = document.styleSheets[g],
                l = h.cssRules || h.rules,
                k = f.toLowerCase();
            if (null != l) {
                null == e && (e = document.styleSheets[g]);
                for (var m = 0, n = l.length; m < n; m++) {
                    if (l[m].selectorText && l[m].selectorText.toLowerCase() == k) {
                        if (null != d) {
                            l[m].style[c] = d;
                            return;
                        }
                        h.deleteRule ? h.deleteRule(m) : h.removeRule ? h.removeRule(m) : l[m].style.cssText = "";
                    }
                }
            }
        } catch (u) {}
    }
    h = e || {};
    h.insertRule ? (l = h.cssRules || h.rules, h.insertRule(f + "{ " + c + ":" + d + "; }", l.length)) : h.addRule && h.addRule(f, c + ":" + d + ";", 0);
};
window.FlowPaperViewer_Zine = function(f, c, d) {
    this.aa = c;
    this.ia = d;
    this.toolbar = f;
    this.na = "FlipView";
    this.Jm = this.toolbar.Ya + "_barPrint";
    this.Lm = this.toolbar.Ya + "_barViewMode";
    this.Im = this.toolbar.Ya + "_barNavTools";
    this.Hm = this.toolbar.Ya + "_barCursorTools";
    this.Km = this.toolbar.Ya + "_barSearchTools";
    this.wa = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    this.Qh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgchEmOlRoEAAAFUSURBVDjLrZS9SgNREIW/m531JyGbQFAQJE+w4EuYWvQd7C0sAjYpfQcfwsJSXyJgbZFKEhTUuIZkd8Yimx/Dboyytzz345yZuZdxF2x0SpthiBbsZ3/gXnofuYBXbjZSrtevHeRycfQ0bIIo76+HlZ08zDSoPgcBYgz2Ai/t+mYZOQfAbXnJoIoYVFzmcGaiq0SGKL6XPcO56vmKGNgvnGFTztZzTDlNsltdyGqIEec88UKODdEfATm5irBJLoihClTaIaerfrc8Xn/O60OBdgjKyapn2L6a95soEJJdZ6hAYkjMyE+1u6wqv4BRXPB/to25onP/43e8evmw5Jd+vm6Oz1Q3ExAHdDpHOO6XkRbQ7ThAQIxdczC8zDBrpallw53h9731PST7E0pmWsetoRx1NRNjUi6/jfL3i1+zCASI/MZ2LqeTaDKb33hc2J4sep9+A+KGjvNJJ1I+AAAAAElFTkSuQmCC";
    this.Rh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGggFBG3FVUsAAAFTSURBVDjLrZQxSwNBEIXfbuaSUxKUNDYKRmJhZXMIgv/FIm0K/0kau/wdqxQeaGEQksJW0CJ4SC6ZZ5G9eIZbc8pdOfftm/d2ljE3KPXZchhEK9bjH7jX+8TfsH7addzLRA683HI+ZhcQxdukUQ+8nIbhdL8NIR6D0DqXd3niCgBgxOr4EkKwYQrDZEXTmBGiqBVjaw6mpqu8xXet+SPC3EGPnuO4lSMhhHpG/F1WQrRMX4UA3KpHwJJKks1hHG8YJeN42CRJJbO8gwggzjc1o0HvZ94IxT4jurwLpDVXeyhymQJIFxW/Z5bmqu77H72zzZ9POT03rJFHZ+RGKG4l9G8v8gKZ/KjvloYQO0sAs+sCscxISAhw8my8DlddO4Alw441vyQ1ONwlhUjbremHf7/I0V4CCIAkOG6teyxSAlYCAAgMkHyaJLu/Od6r2pNV79MvlFCWQTKpHw8AAAAASUVORK5CYII%3D";
    this.Kh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgcmKZ3vOWIAAAG3SURBVDjLrZS9bhNBFIW/uzOLwVacSIYCCUVCyivwAkgGJ31cpMwT8A6UlKnSpKTgARBPkCK8QZCIlAqRBPGXxbF37qFYO8aWNk6QVyvNnNlP52juzlx7xa2e7HYY0ZfspztwF6e/aoHQXO+MudOvq49rubL4/HsdovPz25PW/TpM3l750m4Txdmjdqjftd0L6WyFKGjZjcWxViGikwcHE/0eMmHsHiBMxod3mCDkTiYhdyXf7h0PDYDK3YbHvW1PchfSmEve3zzfvwQz8Gq43D/f7Hu65jyllHa2OLpqgASpGhpXR2ztpJSSS1GUDrvPP318nyJYlWtAvHj7/Vk3HEApMnfcvXuydxg3AkjIhQRhIx7unXTdHfcInoCnb/IMZIAlA1B4jY8iCRyicAeFMC3YtJpZAzm4iKrWZTI0w8mQqfpKFGn+b/i8SiKWDPI57s+8GpRLPs+acPbPO9XYWOuuuZN000SZZnKv/QyrMmxm9p/7WMxBNHg5cyFezCiIEMUD2QK3psjg4aJW5B3IJF/jJkNjrTr3o2bzx6C+v+SrKiACRd5p1IeOitGkfsPh0vrksvvpX4Z15Dxt627DAAAAAElFTkSuQmCC";
    this.wg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGggfBarvnwYAAAG+SURBVDjLrZQ/axRRFMV/9+2bnUkgKGlsFIxEECWfwMaPIJhqk0+QbUxlkyqdrWBrp/gZ0sTGVgJptkkKmyASLRaHdWf2Hou3f9yVzSaylwf33XmHe+47vDn2kmtFuB6M6Evupxvgvn8p5xM2H24OcV/P4p25uEG/o02Izo+zvJnNxXlRnN9eJ0inWRE1NywWqx0pCuV25WUs74roNEwQnHYLD8J4+hlhHvjwluBgDSdI4E7te62TXlIzSR96J609r3EHKUhIGqi9c3HYBTNQSt3Di522BpISTpK0v8txvwAJlFLRP2Z3f3gehTu8en766f2gCZZ4DWh+e3P57EXjNbgI7kja7hwc5VsR0hhIELfyo4POtiTcI8iBRx/zADLA3ADUeIf/znAQROECxTgRbKJmWEECFzHNjUw2AoySIVM6JaZZpkKzlUSsqRozuGq2quolv2eNcPbXmtTYsNZNeUfs6SVqvBvzjvsZljhsavef91iMS5bwZOrz439NI0grC9sVUoAHi6i1AUEqNoJd9Vtyd1WKolpfO/8131/ivVslRKDM7q+NOepKEGIGkBmUPStH+vX5uSyfXLaf/gE6n/uTJg/UHAAAAABJRU5ErkJggg%3D%3D";
    this.Bg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgcnEaz2sL0AAAGlSURBVDjLrZRNjtNAEIW/ssvDkGgyIwUWSGhWHIEj8Cf2bDgFV+AMLGHBCgmJA3ABdpyBkWaFmAHxGyLHrsfC7dgmsQhSvLG763O/qtddbU/Y6cl2w/DY83r6D+7z+Y9RIJ+czhN3/un4xihXLT78PAUPvn+5OT0cwxSzo4+zGS4urs/y8artIK8vjnDB1BrsBZaqMr190w2mC+FB0a5mIgXLswf2eg3mRZBJKJpHhgkz49fzy/uPom7nkfockkASB+V7e/g4epyLqLukaaSKy1dfb9+xl2k6RCZV7X+gBrP8lr97dna3DVSSB3SmmExgkT+1KIsuEDh93eQtQHbYBQJcRPQI9d4WXX6uTnftX+OPOl3hou7nN/hqA7XwimWxsfkYgH6n8bIanGe1NZhpDW87z4YhawgbCgw4WapUqZCOG/aREia03pzUbxoKN3qG0ZeWtval7diXsg2jtnK2aaiD21++oJRnG3BwcbWVuTfWmxORwbV/XUUxh0yKk20F9pI9CcnFajL5thy/X4pjLcCBRTG/Mi66Wqxa/8pyb/fkvu/TP0a/9eMEsgteAAAAAElFTkSuQmCC";
    this.Th = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGggfGb7uw0kAAAGtSURBVDjLrZS/bhNBEIe/Wc/5DksRKA0NSASFBvEQvAM0IJ4gFfRUtJSJ0tHyEFQU1DQ0bpKCBgkEFBEny2fvj+LW98f2gSN5pdPt7nya2flpZuwlO62wG4bHPfvTNbgfn8vhgOMHx4n7euG3B7nlfKpj8Mivi3ycDXKxKC5vHRKkL1nhGlzmxWQquVBudTKfSBsFvT8nJMksvxIeGSUrpvrDZtPndrZswFEkSBDrJcOEmXH15tuzk7hI9yAFidVTkASSyOcf7cUrdQwu1Ept1Pv8++nPx0/C23QtEaQYO/5r3B+NP7yePm0skkfo+JMJLI7eWZyNW0PEQeslI4AwIcb2wkVUh1Dnv9KLKFxt3FY/TJjauGItX/V2avP1BdWIjQcagKp0rha9em5cmKmBt9WzYchqwvoBepwsZaqUSMv1+0gJE6KbH3W9dALX8QyjG1ra2pe2Y1/KNoTaytmmoN4dCUkXtKZLABc3lun4cKg3CxHg/v9Gh44gSMVRsH9Qxp2J5KI6PLj8Mzxf/O7NEhwos3sHTYxFJQieAWQG5czKlX5zfu9rTu57nv4FFIsPySkiwzoAAAAASUVORK5CYII%3D";
    this.Cg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgcoGry8dfoAAAFASURBVDjLrZRNSgNBEEZfJzUqCZkERhdCCB7GC+jCrXgDb+QRvIBnEQkuxKAQI2NIeqpcTCI9Mp3JQHrzaPj6q5/uLnfPXquznwzRA/tZC93HdBEVdHuTbKObvg/PozqfP39PQJSvz3H/JCYzTQdvaYoYs7O0G6/aHXWL2QAx6LudzXH93BAlKd0eALiroiwlUcTAAjutgWGlbtNDj6D/sVGKoUWQTFEHNcTw21NSRqoCwBuif7tofqC4W16HTZc7HyOGlqceAbiqIsxvj7iGGMV2F+1LYYhnmQR+P3VYeiR8i3Vo9Z4Nd8PLoEm2uAjcnwC4rKJ13PBfel+Dln6hLt4XQ0Bc+BnqIOCumeMaorqUDpw2jSLNoGOmo52GjpGaibHu9ebL+HxJhpaXVeVJdhwPus7X2/6tVgebk4eep79dEZnAuEZ32QAAAABJRU5ErkJggg%3D%3D";
    this.Uh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgggAxtSEA8AAAE0SURBVDjLrZQxT8MwEIW/uJc2VKpAXVhAoqgMbLDyq/iVjAiJgS7twIoEAyJCTerHYNokyGlTVC+fJT/fuzvZl9zTabluMswfOJ720L095u2G/avpr+51bqetutVypimY530+6KetOp9li5MxTnpOM1PrSiwbziQTGiRbi0kGn8I8vSB7AOCuiSDs+VBvrdc+BoQJ1q4lhv6i0qmenaIQJvw6ugWnJgC8MF/5tsbDY6Bw65YINnITPtx6AuCmicpXXXyb9bb2RcJKil4tXhFFidXfYgx7vWfVdNcxVLrN/iWcN7G3b/1flmUE/65jW1+E6zISHJg4Wu3qSyYcXO5KURNwUjZxybZvydlQMlGMR4uv9tzs/DgPVeXpxWjjURYCZylAmkD+neTr/i35ONScPPQ8/QFgdrQzzjNS3QAAAABJRU5ErkJggg%3D%3D";
    this.Dg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAQAAAAmqpm+AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfdBRUTLyj0mgAyAAAC8ElEQVRIx83Wz2ucZRAH8M+72c2mu91NmibFSEgaGy1SrRdFFFIJ9uDBk6KCN6EHD0qLB8GDFwXrQUEK7UnQP0DwUD23RVS8WG2EKrShDSpNYhLaNJtNNvs+HnbzY7fvLmmo2BneyzPzft+Z9zvPzEQngnsoKfdU0rH7Obrw38DNmbK4A4AOOUP2NsJNmdFtYAdwa0om3Ta0ScUt8wbldd01WBArKrihqLge3ax+RR12wnKkU4eqWYXNZPMiOy+ZSF5JWE82kxhZSqfH7Ddg0YwJ01bbEJIRb0YX7oDLOuo5nZg34HFHXXHeby3/Ye3ZgAtNX3vTiAVfm1SWlnPEU4ad800bWupwsWqT6W0j/vC52KCqorIv/eC4cVdbRBgLSAXBmrhBn/GwaaeMeNaoT72oYtjvPpPxsnSTd03XBEEqFtNgyHgSpzyCX2TRbcpVscvO2ufRRLgaRko92U1NO+hn01ZVZC3h9obtopKxBu91jTcvWdzAa0HkV3s8pMuKI9jtBbuUfWvOPw4lVmi8ldmtDg/gusixDcZGjYKzyspN3gnMVhscFgT9/vajPUqWjPlOTt6CuN4gk+CqNbg1lGW2GK6JjDrvKxNirxtTdFwa9Or1p+UEuLK15G5cNul5ObFRrCCug3FYr3PtmnvzfWDZBWlvmbRbpIeN5ljwGr5veSuC6NXANYUGQ94HBl1wpuG0x0f6RGa9o3wH2KL9rUbPktNWjHvfkF2ysorGndGPoM/Hulu1qlcC15uigwe94QmRvyzggC6RgEgQuewTt5qiG24HR9ZBTzskI+WGn8x5F0GEYMKHCXBtBuOKSy41nLznpKjefw8nlnECs63lipOW6y+uJDKbgrRom3rRaRWR4IsmS60yo5cCN6knsR0pKCqbb8gqiGqDEfrM6Ng23GLCthDbp7L+72I9dxVf81ikRywINWYrcnJuJtT6dnaUjG5BqdY+a4clGXtldwAXqyipNG9Qq22G8v+2Lt7f2+e/O1kvzGyGcjEAAAAASUVORK5CYII%3D";
    this.Vh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAQAAAAmqpm+AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfdBRUTOjTXLrppAAAC50lEQVRIx83WT2hcVRTH8c+bvMnMxMSkKU2Fqv1DhQ7aItJWRZEgiAUrKqJuXAZRN2ahRRfd+A+6EtFFF4roTrC4K0pBFDQRIsVakSht1FoUUtoG2oyTTPKui3kmmcmbIQ4Vcu/unvu+75z7O/fcE40G13DkXNMRJ9azd+H/wV1wUqWj8LrdYmcj7pyzYps7wC2aNymkwDjBJWcVdMt3gEsUFU0ZMIhcEJyWVxQLHcxIrKjHpCDUgw0KIp2LEim4IvwbbFcmLKfoLmXbzPjDuHPm2gC7JCuVbU7nkic9poBpW93tKT/41LdtfAzLuGbfYm8om/axH1Xk9XnE/XY55sO2uFz2Ab+p7HvP+UKvoiGJIw7p9rh9bYXJBUHSNA/Y47zD9jhg2CeeUXOb0w7p9qz8qv31GQS5RELDHwqG8bJbLRpTQL8zTqk56SNb7M30i0RSLwGN/hXc7mt/mjOvxyyuLtm+cdXBFr4tXbKkQYoBkTGb3Ktozn3o9bySqndN+8vezAxNWim7FWd0GVlSbGd6I9/xt2pGHjQlSmjYcFGwxe/GbVBx0QNOGHSdy4KcXAtcnREvoKZrhWFKZLfPHfWdxEsY8rQF0G/Ir2oZuJqF7Gpc9bOH9UqUMYckhbHfJsfbVb+wyvVZx+UdNul6kQFsTC39RnCi5a0IWTg+M+UeLxgXvKrsQbDRB3pxVKk1LstwxeuqHvK2HXqUlAw46JgbEGz2vg2tKssTgQnFVYabjbpT5DeXsEspLWKRIHLKK2aaTnxfOxxFuw27Q7ec87407QiCCMGE0Qxcm4exasJEw8qI90RpudzfukCtdfzkRZX0w2prKdbeCox5zbxI8FZmOxEHlCyuGfiVRw2ouLDqpANi2OGX9EzWMmaaNK0Hun35VhRtl/sPwOZXjBv1LL+zNYP6TJntqEeJ3aQ/7W/i+mJF3jZ9GUEsqKXa58Qr2o58Gk1FVbTULC3l3Twur7d2cX13n/8ANgFb4QoS+/QAAAAASUVORK5CYII%3D";
    this.Eg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAQAAAAmqpm+AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfdBRUTMCbeeCOrAAAC4ElEQVRIx83Wz2tcVRQH8M+bzGTixJmkaSNGSmpqtUi1LlREQSXYrRtFXIrgogtFV4ILV11UwYUU6krQP0BwUV23Xai4abQRqlCDDVqa1CS00cmbzMy7LuZHZqZvxnao2Ht4MLxz5vu+937PPedE7wS3cWXc1pVN3Mnswn8Dt2bZ5hAAIwpm7e6GW7ZqwswQcDVlS/4yuyPFdev2Gjd2y2BBoqToipJSi91V00pGDKNyZNSIuquKO5sdFxk+ZSLjykJrs7lUZhmjHnG/GZtWLVqxPUCQnGSHXbgBLu+I541i3YxHHXHRGT/1PcPG04YLPV87as6GLy2JZRU850n7nPbVAFmacIl6j+stc37xqcRedSWxz33rbfN+7cMwEZAJgpqky572oBUnzHlG1oQpVfv97GM5L8v2RDesJgitEpB0ndoTOOEh/KCo4rJ1cMEpL3rYQh9+zRKQqHdY1kHnrNhWlbeprNr2LSh7tiu6ZcnOJUu62BVFfrTLfmMqHZxjX1vzp0OpGZp0KtsZcC8uibzRVixq/jolFvdEpyhb7wrYEEy77Du7mrlOomijfTppcPUGXA2xXIfjN5EDzvjCokRO1ai4WWenTPndVgpcrJZejWNLXlCQONBkst0OO2zK6UHFvfc+sOWsrDctuVskkmmfXdGr+KbvrQhpcJy17HGvOddM8UbEpA8VcKxPXQxCeuv520kV89436y55eSXzPjGNYI8PTPQrVa8ELine4LjP6x4T+cMGHjAmEhAJIhd85HpX/KZ9g+DIO+gph+RkXPG9Ne+2szBYdCwFbkBjrDjvfNeb9xxvyhI5nJrGqVL0Wxcdt9X8Y6W/FFnRTdqCk6oiwWc9nmyD9UuBa7Rz699XUUlsvWtXQdRojLDHqpGbhttMmRYS96i2zi4xeUv8etsik5JGNQ6oKii4Jh5qRsmZEJQb5bPxsixnt/wQcImqsmrvBLU9oCn/b+PinT19/gPF4yPjYMxK2QAAAABJRU5ErkJggg%3D%3D";
    this.Wh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAQAAAAmqpm+AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfdBRUUAAI4cucMAAAC30lEQVRIx83WT2hcVRTH8c97eTN5E5M2TWkq+Kd/UGjQFpG2KroorgpWVETducpCV2YhRRdd+Qe6EtFFF4rozkVxVxRBFGoiRIpakfinUWtRSGkbrB2nM5l3XeR1kkzejHGokHM3j3fe+3LOPb977okmgutosetqSWY9Rxf+H9x5p1R7Sq/sdretxJ11RmJrD7imuhkhByYZLjqjX1mpB1wmlZo1bARxEJxWkkqEHlYkkRowIwiLyQb9Ir0XJdLvsnAt2b5CWCx1rzHbzfvNlLOudgH2yZZXtl3OFU96TD/mbHOfp3zjA190iTEs4dpjS7xizJz3fauqZMgjHrTLce92xcXFG/yqMV951icGpUZljjqs7HH7uhYmDoKsbR20xzlH7HEQIwY03Om0w8qeUVr1/eIKwrUWsDzZ1AG84A5NkzJ/qmmCU97ztL1OdlBg3gJWxtfvLif97qq6AU1NCy3f5/5yqENsrUOWrYhuWGTSFg9IW9L40Qaj3jTnD3sLFZp1quw2/KTPeKtiUf70hr/VCnTQJpSw4oMLgpv8asomVRdsRnCDS4JY3AG3yEgW0NC3zDErsttHjvlSJlUXW8h9G436WaMA17BQ3I1rvvewQZkx1GQtGPttcaJb9wurQr/ihJIjZmwQicXKrdjG8XHHUxGKcHxo1v2eM5VLqA42e8cgjql0xhU5LntZzUNet9OAiophhxx3I4Kt3rapU2d5IjAtXeW41YR7RH5xEbtU8iYWCSJfe9F8247v64YjtdsBdyuLnfOpOUdbKgymTRTgulyMNdOmV7wZ91Yu6cj+zg1qrfad51XzH2udS7H2UWDSS+oiwWuF40QSUMkb0FrsM48aVnV+1U4HJLDTD61j/u8231bTxUR3LJ2K1A7xfwC232LcbGDpnm0YMWTWlZ5mlMQtNubzTbL4sqpku6GCJBY08trHkmVjRynPpqomag1LLd3VcWm9jYvre/r8BzXJTgadvkYEAAAAAElFTkSuQmCC";
    this.yg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgcqC+Q6N4oAAAF8SURBVDjLrZRBThRREIa/mq5WmJGBZJgFRjFx4cJ4AY/hhgvIAUyUW8DGtV6AAxjvoSsXJqILI2qiSDOZ6a7fxYOB0N1Om8zbvaov/19VqZQ9o9PrdcPwWLKe/oP7cXTSCmT97dE5d/RtfauVK4uPf7bBg98/7wxW2jDFcO3rcIiL4/Ewa+/abmTV8RouGFjAg6ebdej76w9gg0J4kGcB7K6807Uhhd3ffQFkeeACBTB6v1/X23sUgFDi0gwba0xB4SKqFKqauAoghIsyWKBXCo+5dgOn81zgdPEFF7FQL9XXwVe4qBb2UQkvmeQpctZEnQFMyiXvs65w04b89JKbx8YPM7+2ytW47nu487JB8LCm9+rL3VJQygBkDuaf39b04k3HPswg/Pm9U4DBp4OyN9/M5Ot28cHs8a30uW0mIKUcXKzKLlt80uTaFz3YXHSKYgQ9KTawf1DGRkguZv3+r0n7fcnXVYADRT662W46K2YX85tOl3Ynl31P/wJHQa4shXXBLAAAAABJRU5ErkJggg%3D%3D";
    this.Mh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgghCwySqXwAAAGGSURBVDjLrZS/ThRRFMZ/d+YMO26yamgWEzdxFRsbqaTlGXgEnoAHwG20puABaC1MfA5jYWJsaBaNjQUJFIQJ2TtzP4sZdgh7B5dkb3XvmV++b86fHLfPUidZDsPCivX0AO7se9FtuPZ6s+H+TG3YyVWzE22CBc6nvbWskwt5fvp0nUT6meWmzuMs759IJtRzgrfvny2K/f3wA1zvUlggdQIm/a+6U6Tg3kx2AZeGOt8AbHyLdPDoXd0GYYKmhNFKquVU312EczUnYSI02iGmFgCCsLCMb8BaoejkhAY2EZp/VUxNN74PzvceTsJKfFpHfIzyAL5c8TzrFjeLfJ+13Dw23ErvTKuvhou+x3ufIoLHC3qHv8deUAYHoMTAZb++LOhVn5fMI3FQZR9fXQIMpgc+bVsvbL4S6o7vPK5fI1HdXhomHrUByu2YbS4SePm/UmsMiZSPE3cP5Xjel0z49cHpVfd+sdGTAgwosheDuUfpBYllAJmD4toVN/WbcbGqPbnqffoPyHTE/GI3wZEAAAAASUVORK5CYII%3D";
    this.Ag = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgcqK99UF0IAAAGmSURBVDjLrZTNahRREIW/un3bnx4zCYwuBAk+hb2ZbV7BB3AhZlAQRN9EEBGXQQJBfArXvoCLWYnBgEbGIdNdx0WmTd/uGY0wtbunT9epOrfq2lMuFeFyNKJvOJ/+g/dterqWkBW7oyVv+nX79lpeNfv8cxei8+PkzuBa8s0uipEPt74Mh0RxfGuYdbu+O20Qu5LVx1sEiYF5J/b2WwcbIEUn72Ur759U7VZyJwrkaW3lI07bkNA5r+WhOeUEQiohovA6yTae4KGNgYsoquTf8QQFSLBKRE+x8jFClvJwIolu+QxhoFQXovA/lureCzz0853X12BZPX5OnS2vq99vvcSC3wCTNVIXUYtYMc8b3aPqSXAD8F9t3rzqzPOHl4Rlwr/Ms+B92LcVEy5C+9Iwjt5g9DJKqa6Md28x/+ceyXTAg7BCt4sYB687tqzcS5kOeVjQ97mnweFoL+1aRIjd9kyvPsX24EeI4nrXWZk+JudCBLjpfeksGZcRBMl3+sa2V4Edl6JYFMX3+fr3Jd/WDCIwy0dX1/J8MVs0/p2dbeyd3PR7+hsfn9edOMpPUgAAAABJRU5ErkJggg%3D%3D";
    this.Oh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgghLkeWfTsAAAGuSURBVDjLrZQ/axRRFMV/983b7BiMSgptFIxE8GOILkgaaz+Eha2FRfwL8Q9pg2ih6Mewt7FJkyYp7EQwpHCQnZl7LOIu897Okgj7qnl3zpxzz713rj3gVCecDkb0BfPpP3A/v1XzBZeur//Dfd+Pl+bi2vGe1iE6v/aHS4PknXWS8bI8uLBKkHYHZVRyXDfC5NliubwnBUlDU3buPetcbDiWolNY7nl0/0fTTaPwY7+e5jZ6zFFafhEFXbrgjJ5C0CxOnZi1bGziQQlOIgpPNDY28YCSmIvoqe7tJ7jJSHWdSPLtrS3cLLOGIArX1MPN13gQOZ8nfov2zhZNnGQ+36/OQZBNpFK/DXVxfKvtkx6FtgBQ3cXVTTbPn59TuJ00z4KP9jD0AEVaeePDm2mKSYKproy324S2Z/yzTgZ2tilO4gMP7LzM2tHDB268f8XZnG/2/xW8u3g3ZA2OPSvB9OJr4enSiOJMbk+mL0mgFAGu9UgnjrUGQSrXwkxh227tLy9LUdSrKwe/5++XeOV8BRGoBldXphpNLQhxADAwqP5YNZmDMYeL2pOL3qd/AZpy8NOvjvTnAAAAAElFTkSuQmCC";
    this.zg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgcrBRqZK8wAAAE8SURBVDjLrZTNSsRAEIRrfuJPwmYXogdB9mmy7+P7iIgIIoKIL+RhT+Ki4A8hbJIuD+qaSWbWCKnTUPmopjM9rU4wSHoYBisj5/Ef3PPyPQiYeJ59c8un6VGQq4uHjzlgBW8vx8leCKOkk8c0hSVWh6kJd612TLOaQJNIlPzqVLpSCUgtEpm2i7MeaCIRTYIOh/MuR5AeDhd+Tpq2AOCycSWkJmvp5AFXbmBNahH0OVy7nogG+nUB3Dh1AU2KJw+4dTqhJuHlcNfySE02fg73G68hbY0y8t9svjmV9ZZ5zofNs4MxyLlpDNXNh72jLhbIy4e9yz7m7cOTRljAKsdbqH5RwBL7bH9ZeNJiQgMHf60iyb7maga1hVKYCWmJKo5fy/B+iaYsAAugiLLdcNGqqH7+33o92p4ce59+Av+enpsD10kAAAAAAElFTkSuQmCC";
    this.Nh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGggiBLcA5y4AAAE5SURBVDjLrZS7TsNAEEWPN+vERIpAaWhAIigU7vkwPhIQRDxFkyYpaJGgwkJxmEsRiPzaxEi5lTU6vuNZz97oglZy7TC87dhP/+DeHrJww+7Z+Jd7nfnDIPe9mGoM3nif9bpxkLMkmR8McdJLnHgFFfmkP5WcpF5UqF/Wyd5CcmadIiau6mDHzElgBcG1VQSSkyi9DNxUDVecqhy39XG8sPovnpyXz0Y4s1pf4K5cM3OgykcDcF+sCZxkDX7wWKhZ87wrPW2fd6Xn0rxL8k7zBqTrp3y5YZ/TdvtcwhTkym4K9U3b3aMqFvBL293LOtY4R4ObcLVISBtDw0l72zASycHptujQCJyUjFy0gYo46kte5MPB/DOcL/54PwMPZPHJYN1jmQucjwHiCLKvKPs7vwUfu8rJXefpD93iniqiS4VUAAAAAElFTkSuQmCC";
    this.xg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAAAAACpyA7pAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGgcrJ8/5aigAAAJ5SURBVDjLrZTfSxRRFMe/d+aOq2v7I9fV/JEEYWVaGZrgQ2DYQ0HQW73ZSw+BPgRBUA9FPvUiRC+Bf0AQRBGR1ENEoWgERmhgij/a1owkdXSb3WZnzulhZnZHc8vA83bnfO73fO+dc4+4jC2FsjUMkrZZj/+D+5FYKwiowbqYyyW+R6oKcpYxk6oDJGF1qba0uBDGFA59C4chGYvxsFr41KJItRdDkAyUCgcTjHjTgZpUYvzTLz9ZajAkQcupBc6eBi9V13d+fjjuP4pGkAwwOWqip0l/MqWrFR3tV+6/8HkEQz2KVDE70dM8evvr3ob65YHJ9iOJefYCmR2QDLKdbZ1tk30nLmhiNpr60He1a0LPCRJDMizHXuA47rZdxNSDjwBGn5459CZ/hwyFCERERPH64XQXZm6NkWCiYdFOuQCRhFe3TLyL76Q7GcAGkEg02/m6gGSQU7cCC5oYTLopw2Da4A/OhxVEl3nMS6pSIf/NKMy2Y2Kem5LC8ixV1c7m/dnM0kJGAwDMfTnV/2hX2lVoKX6ezsllLF8/rw2o3ffeB5xF9XkeXd+GjVhxc3Otx4qeOYeM91aKfa+zwoXMqI8T2bGO1sbln4pWefJ6FYvylsFMnhPnMBfyxHd3t4iFJWW/wmABTF1zf93aHqgHoQc8bvXltFldFpp+/KpNQlC8wW0aMwK5vsuHhkoETAt6r2JJPux7v7zhYaYNwwJGbtiqLfL7+Q/OjZGbpsL9eU4CUmwGvr1Uo0+4GQlIRglvCiaTObUgQwHK/zWKKAYozBSF+AslECVmycgGg3qm8HzRImwAEoChxQKFi2aNrDevTHPb5uR2z9PfLQs68f4FXIYAAAAASUVORK5CYII%3D";
    this.Lh = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAnCAQAAAAmqpm+AAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wGGggiGzoI6tsAAALsSURBVEjHzdZNaBxlGAfw3+xOspvFYK2WSlvTpih40IJgP9RDIQcFEQLB6kFykUIvUj9zCR4KiiCItCB6UqEXDyqePAgpRhCtaSmYYonFJsGepHXrRzfE7mZeDztJZzezoV0r5HlPM++8//n/n6/3iV4KbqEV3FKLE+uZXfh/4C45Y6Ereb3uc28r3K8uiG3uAm7JNTNCChgnqLqgpFdPF3CJsrJZG2xEIQjO6lEWC12sSKysYkYQmmKDkkg2KM2nLfZ5yE5/Oe8HZyx2YBgp+VtYFltsAyPo87znEPzmTrs87bz3TXUELEqykU1amBW8Za/ffWRaVWyrYU846phPOnoxLPtOizcSwZv2+MazTtjhKSNKjjhsyYv2d/ChrO9apY4YMm3MsNf0iszY5KqTXnXUmB9Vc7mFZbGJbOX2eRLjhozjrA+cSne+ddyovb7MTZiAQhMqS3uLB01Y8ArOOWRKUEi/mRB5vIPYRCJuEs2y2ywyaZtNlryeJsfy/qxfPCLpEIgVsVnfbcVFJZGvzLUdqqmtHM0TmyZK9oMruMtlwelVB4tiBWHtRGld84Ld5kUaq/YGDPp5jZKLG6grZv4yb9YB7zpuQL2NwX4VX6x6C3WN/G78p88UjXvbSeWWnQEHBd+v1f1Cjic+dc6wl33XUvR3O+Y2kTf0I8pN5By4gpoxVQd96FEbVFRsN+pz9wvY5WN35JAIguiZwFSbKBg07jGRiy4reiCNZ0hZ/eRQW6kt2oPoQOBUDhwFQ4bsU8KcE/5wRK8g0hA7bbQNbjfNqujUtidMqIhEFjVwxXuKGmKJh288FFlbUHNVA0x6QUNRI/d67hCKtWzSYf8oCt7JhYtvdhT42ojtqqZzx4k4oM/STQDOrWoMUG7WLOz0X0eLYPB6KMoGFXLy/MYswjaV63dF3Ub9ZtW6mlFi97g9nW/i5XTosUN/joiGeuqKgjgzdvSkahYsilaGpZV79lraONfVuLi+p89/AdAUWQEn4HTQAAAAAElFTkSuQmCC";
    this.Nf = "data:image/gif;base64,R0lGODlhAwAVAIABAJmZmf///yH5BAEKAAEALAAAAAADABUAAAINRBynaaje0pORrWnhKQA7";
    this.fp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAANCAYAAAB/9ZQ7AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA3XAAAN1wFCKJt4AAAAB3RJTUUH3QkaAjcFsynwDgAAAMxJREFUKM+9kLEuRQEQRGeuV5FIJApBQZ5EReFP/IBCBIVvpFT4BR9AR+29cxTukyvRaEyzmd3Jzu4kI4Ad9d4JANVLdS1JhvwB/yBuu0jiL5pl22WSzNRBPVE3225MVW2TZA84bfsWYFDvgNX30zQY6wtwmCRRo96qy9V8Et2zevDjMKDqFfA+2fykzr9F6o16vnIALtRX4AE4GvtbwHVGq8epi3qm7k74HFjMRrINnLdd/6KS5FgdkpBkv206DkzykaSTbWkbdUyxs094zOEo59nhUAAAAABJRU5ErkJggg%3D%3D";
    this.jp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAANCAYAAACZ3F9/AAAAAXNSR0IArs4c6QAAAAZiS0dEAFEAUQBRjSJ44QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wCCgAwB/13ZqAAAADXSURBVCjPhZIxTkMxEETf2F9I0EaCI9DRUZEL0XINbpMzQJ2eG1DQpvszNDbyN4kylde7O+PxLgxIckgS2+mw3ePDWFumxrPnc/GmURKXMOfKXDAzX8LcWEfmTtLu6li42O4SD8ARuAHW6RVV0tH2PfANsAyMT8A7cJo9JSHJHfAsiSSoKa6S6jWfjWxNUrtiAbKtUQaSLh+gSEppSf3/3I1qBmIl0ejxC3BnHz02X2lTeASgr5ft3bXZ2d71NVyA1yS3pZSfJB/AS5I/xWGWn5L2tt+A0y9ldpXCCID4IwAAAABJRU5ErkJggg%3D%3D";
    this.rp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3gIDABU3A51oagAAAIpJREFUOMulk9ENgCAMRKkTOAqjMIKj6CSOghs4gm7gCM+fGgmCsXJJP0i4cj16zhkBjNwYreSeDJ1rhLVByM6TRf6gqgf3w7g6GTi0fGJUTHxaX19W8oVNK8f6RaYHZiqo8aTQqHhZROTrNy4VhcGybamJMRltBvpfGwcENXxryYJvzcLemp1HnE/SdAV9Q8z4YgAAAABJRU5ErkJggg%3D%3D";
    this.ep = "data:image/png;base64,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%3D%3D";
    this.tp = "data:image/png;base64,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%3D%3D";
    this.hp = "data:image/gif;base64,R0lGODlhEAAPAKECAGZmZv///1FRUVFRUSH5BAEKAAIALAAAAAAQAA8AAAIrlI+pB7DYQAjtSTplTbdjB2Wixk3myDTnCnqr2b4vKFxyBtnsouP8/AgaCgA7";
    this.ip = "data:image/gif;base64,R0lGODlhDQANAIABAP///1FRUSH5BAEHAAEALAAAAAANAA0AAAIXjG+Am8oH4mvyxWtvZdrl/U2QJ5Li+RQAOw%3D%3D";
    this.kp = "data:image/gif;base64,R0lGODlhDQANAIABAP///1FRUSH5BAEHAAEALAAAAAANAA0AAAIYjAOnC7ncnmpRIuoerpBabF2ZxH3hiSoFADs%3D";
    this.vp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAAXNSR0IArs4c6QAAAAZiS0dEAFEAUQBRjSJ44QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wCCgEMO6ApCe8AAAFISURBVCjPfZJBi49hFMV/521MUYxEsSGWDDWkFKbkA/gAajaytPIFLKx8BVkodjP5AINGU0xZKAslC3Ys2NjP+VnM++rfPzmb23065z6de27aDsMwVD0C3AfOAYeB38BP9fEwDO/aMgwDAAFQDwKbwC9gZxScUM8Al5M8SPJ0Eu5JYV0FeAZcBFaAxSSPkjwHnrQ9Pf1E22XVsX5s+1m9o54cB9J2q+361KM+VN+ot9uqrjIH9VJbpz7qOvAeuAIcSnJzThA1SXaTBGAAvgCrwEvg0yxRXUhikrOjZ1RQz7uHFfUu/4C60fb16G9hetxq+1a9Pkdears2Dt1Rj87mdAx4BfwAttWvSQ4AV9W1aYlJtoFbmQJTjwP3gAvAIlDgG7CsXvu7uWQzs+cxmj0F7Fd3k3wfuRvqDWAfM+HxP6hL6oe2tn3xB7408HFbpc41AAAAAElFTkSuQmCC";
    this.gp = "data:image/png;base64,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%3D%3D";
    this.sp = "data:image/gif;base64,R0lGODlhEAAPAIABAP///1FRUSH5BAEKAAEALAAAAAAQAA8AAAIkjI+pi+DhgJGMnrfsxEnDqHgRN3WjJp5Wel6mVzbsR8HMjScFADs%3D";
    this.qp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NDJBOEJGMUEyN0IyMTFFMTlFOTNFMjNDNDUxOUFGMTciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NDJBOEJGMUIyN0IyMTFFMTlFOTNFMjNDNDUxOUFGMTciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo0MkE4QkYxODI3QjIxMUUxOUU5M0UyM0M0NTE5QUYxNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo0MkE4QkYxOTI3QjIxMUUxOUU5M0UyM0M0NTE5QUYxNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PrESQzQAAAF3SURBVHjaYvz//z8DPQATA53A8LOIkRLNNpaWAkCqHogVgBjEbjxy/PgBbGpZKLRkPxAbQIUuAPEHXOqZsRhwX05WVhCIHzx68gSnRqB8O5AKQBKSAGIPoPhFoL4HBIMOaNF5JFcuAOKF6MEBVOMA9Q0ukAjUs4BQYkhECoIEkIFAg/dDDYeBfAIh2w9Ur0BMqkMPMgeohfOhBgQQsAiWSPAGHcig+3gMeQBNZYTAA2jogCy1Z8SRokAung9VRCkAWRiIK+guQBVQCj5AzalnITKOyAWg1HoQlHoZCWRIUBD2kxmEG4BJPJBgWQdUBPM2ufG0EaVkALkcmJN/YFMJyuHAnM4IzcAcpAQZ0KGF6PkoAGhZAzSosAUfP4m+AoVEINYiCGQRNLeDIu8iVE6fiIyJzRJHoG8u4CzrgJYlUBDxsBQWCI1b/PURtFSoh5ZxxIIL0HpoA8kVH1J55g9NCAJowXMBmj82YAsmrBaNtoIGvUUAAQYApBd2hzrzVVQAAAAASUVORK5CYII%3D";
    this.mp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NDJBOEJGMUUyN0IyMTFFMTlFOTNFMjNDNDUxOUFGMTciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NDJBOEJGMUYyN0IyMTFFMTlFOTNFMjNDNDUxOUFGMTciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo0MkE4QkYxQzI3QjIxMUUxOUU5M0UyM0M0NTE5QUYxNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo0MkE4QkYxRDI3QjIxMUUxOUU5M0UyM0M0NTE5QUYxNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pj8crNUAAAFxSURBVHjavFbNbYMwGDU0A7BA2oxAj5EqlU7QZgKSY4+ZgDJBmgmAY09JN8ihUo7NBqVVBmCD9H3qc4UsnCBi8qQnGwN+fL/GU8TdePyCIQZHyg1KsPjYbmVf5VEkwzBV/SCH2MyjJYnqF6lPd/WN2HcYk2O4hMYfJEaHSwj5l7JocOTeBgzAd84j8J6jM6E5U16EQq69go8uXZeDO4po6DpLXQoVYNWwHlrWOwuFaBk79qomMRseyNbpLQK34BOYca1i3BaGS/+Bj9N989A2GaSKv8AlNw8Ys1WvBStfimfEZZ82K2yo732yYPHwlDGbnZMMTRbJZmvOA+06iM1tlnWJUcXMyYwMi7BBxHt5l0PSdF1qdAMztSUTv120oNJSP6rmyvhU4NtYlNB9TYHfsKmOulpU1l7WwZYamtQ69Q3nXU/KcsDelhgFu3B8HBU6JVcMdB9YI/UnVzL72e/frodDj9YEDn8glxB5lotfAQYAtCJqk8z+2M8AAAAASUVORK5CYII%3D";
    this.np = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6Q0FBOEM3Q0EyOTQ4MTFFMUFDMjBDMDlDMDQxRTYzMzkiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6Q0FBOEM3Q0IyOTQ4MTFFMUFDMjBDMDlDMDQxRTYzMzkiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpBMENEMDM3NTI5NDgxMUUxQUMyMEMwOUMwNDFFNjMzOSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpBMENEMDM3NjI5NDgxMUUxQUMyMEMwOUMwNDFFNjMzOSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Ptz3FgYAAAErSURBVHjaYmQAAhtLSwEgVQ/ECUAMYlMDfADiBUDceOT48Q+MUEv2A7EBA23ABSB2ZJaTlW0HMgIYaAckgJiDCRpctAYJLFjiBBS2E4GYn4pxJsCCRdAQGHkPoIlkIzT+KAZM6L6BWQICQPYBaoUdukUCQF/A4wzILqCWRaDk/R9HkmSgZpJnwiFuQKIlFwgpwEgMwHhhRObDfIxDvBAoPgFJDBTs/dhSKhMFoZGIbAnUMaAixxGaRahjEchQoA8MgNgBTfwCtIyjjkVAC0BBdB6Uz4Bs9Ly2kZpBh5z0HQglDiZaFGygaoEuFpGSj0YtGoEWgUrv91Rs+eBsETFhKy5oABaALGokppinsLnVyPzoyZMfwCbXSlCTCIg1oDS1GpAzoKX8B4AAAwAuBFgKFwVWUgAAAABJRU5ErkJggg%3D%3D";
    this.pp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3gEfAAUcuIwRjAAAAVpJREFUSMftlrtKA0EUhr9ZFkEMCCpYCb6AIGJzdF7AUhRsREF9AQmCl1IhgpjGwkohb+Ab2Ew4ldZik8pOVOy8kNhMYAhBd5PZVB5Y2BnO8O3M/5+zYwCsyA6wD0wALeKEAZ6BY6daM1ZkA6hRbGwmQJniYy8FRnMsePVHOwSUcqwbSfJo4lTHnOo4sJx3S0mOXA3eh4sEHVmRnkVKM+adONXbDutGBT0CW0613mX+FGgGc4f9gK6AehdTPAAH7bEVMX+BkgxOy+LGVr9Ht2ZFZoDrUCMrMusLvRlLozn/OCA0wxSwXpS9+4p/UDu+iwJ12vetKFAp7HNOVYE7P/wC7oFqjF634FSrQR3hVOfDBCuyHWNHK1ZkMYCEgEy6GSvSAKYzAs+BS+AJ+PD/pUlgCbj45cMbac6WX+71jpEALwMoo/cEqAwAVDFe0FXgzN9uYsYnsOtUb34AitxcDYrQdlwAAAAASUVORK5CYII%3D";
    this.lp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NDJBOEJGMTYyN0IyMTFFMTlFOTNFMjNDNDUxOUFGMTciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NDJBOEJGMTcyN0IyMTFFMTlFOTNFMjNDNDUxOUFGMTciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpDNTQyQTc3NTI3QjExMUUxOUU5M0UyM0M0NTE5QUYxNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpDNTQyQTc3NjI3QjExMUUxOUU5M0UyM0M0NTE5QUYxNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PkQAqvIAAADoSURBVHjaYmEAAhtLSwEgVQ/ECUAMYlMDfADiBUDceOT48Q+MUEv2A7EBA23ABSB2ZJaTlW0HMgIYaAckgJiDCRpctAYJTFSME3xAgIlCAw4AcSAoDoBYEBjpjCCMTSELJZYADXUkVjElPppIimIWCpMtHACzyXt88U22j4DB9gA9wmkVdCQBcixqxJaykFJcIb18JEAvi+SxCYIK1f9kJgZGtFT3f8gmhlGLRi2i3KIPdLDnAwu0SVRAqk4SM/oCkI8a0esWGjS3GpkfPXnyA9jkWglqEgGxBpSmVgNyBhAnghqQAAEGADc+O4K5UN0FAAAAAElFTkSuQmCC";
    this.ra = f.ra;
    window[this.ra.Ji].changeConfigSetting = this.Pm;
    this.aa.Wb = -1;
    this.ig = !0;
    this.pb = new ja;
    this.vc = new ka;
    this.Kn = new la;
    this.Om = new ma;
    this.Bp = new na;
    this.Pm = function() {};
    this.Wm = function(c) {
        var d = this;
        d.Ya = c;
        d.ra.ac = "FlipView" == d.aa.ba && !(eb.browser.safari && 7 <= eb.browser.Hb && !eb.platform.touchdevice);
        d.ra.document.DisableOverflow || (d.Xb = d.aa.$d ? jQuery("#" + d.Ya).wrap("<div id='" + d.Ya + "_wrap' style='" + (d.ra.ac ? "position:absolute;z-index:50;" : "") + "opacity:0;text-align:center;width:100%;position:absolute;z-index:100;top:-70px'></div>").parent() : jQuery("#" + d.Ya).wrap("<div id='" + d.Ya + "_wrap' style='" + (d.ra.ac ? "position:absolute;z-index:50;" : "") + "opacity:0;text-align:center;width:100%;'></div>").parent(), jQuery("#" + d.Ya).css("visibility", "hidden"), d.ra.PreviewMode = d.ra.config.document.PreviewMode, null != d.ra.config.document.UIConfig ? jQuery.ajax({
            type: "GET",
            url: null != d.ra.config.document.UIConfig ? d.ra.config.document.UIConfig : "UI_Zine.xml",
            dataType: "xml",
            error: function() {
                d.Pj();
            },
            success: function(c) {
                d.Jc = c;
                c = eb.platform.touchonlydevice ? "mobile" : "desktop";
                !eb.platform.Ib && eb.platform.touchonlydevice && 0 < jQuery(d.Jc).find("tablet").length && (c = "tablet");
                toolbar_el = jQuery(d.Jc).find(c).find("toolbar");
                var e = jQuery(d.Jc).find(c).find("general");
                d.readOnly = "true" == jQuery(e).attr("ReadOnly");
                d.backgroundColor = jQuery(e).attr("backgroundColor");
                d.linkColor = null != jQuery(e).attr("linkColor") ? jQuery(e).attr("linkColor") : "#72e6ff";
                d.ra.linkColor = d.linkColor;
                d.ke = null != jQuery(e).attr("linkAlpha") ? jQuery(e).attr("linkAlpha") : 0.4;
                d.ra.ke = d.ke;
                d.backgroundImage = jQuery(e).attr("backgroundImage");
                d.wp = null == jQuery(e).attr("stretchBackgroundImage") || null != jQuery(e).attr("stretchBackgroundImage") && "true" == jQuery(e).attr("stretchBackgroundImage");
                d.aa.Uf = null == jQuery(e).attr("enablePageShadows") || null != jQuery(e).attr("enablePageShadows") && "true" == jQuery(e).attr("enablePageShadows");
                d.Ta = ("true" == jQuery(e).attr("forceSinglePage") || (eb.platform.Ib || eb.platform.ios || eb.platform.android) && eb.browser.Hi || d.aa.gf || d.Zp) && !d.ra.PreviewMode;
                d.ec = jQuery(e).attr("panelColor");
                d.$e = null != jQuery(e).attr("arrowColor") ? jQuery(e).attr("arrowColor") : "#AAAAAA";
                d.Yj = jQuery(e).attr("backgroundAlpha");
                d.hg = jQuery(e).attr("navPanelBackgroundAlpha");
                d.Kk = jQuery(e).attr("imageAssets");
                d.Sf = !eb.platform.touchonlydevice && (null == jQuery(e).attr("enableFisheyeThumbnails") || jQuery(e).attr("enableFisheyeThumbnails") && "false" != jQuery(e).attr("enableFisheyeThumbnails")) && (!d.Ta || d.aa.gf);
                d.ig = "false" != jQuery(e).attr("navPanelsVisible");
                d.kn = "false" != jQuery(e).attr("firstLastButtonsVisible");
                d.We = null != jQuery(e).attr("zoomDragMode") && "false" != jQuery(e).attr("zoomDragMode");
                d.gr = null != jQuery(e).attr("hideNavPanels") && "false" != jQuery(e).attr("hideNavPanels");
                d.Ym = null != jQuery(e).attr("disableMouseWheel") && "false" != jQuery(e).attr("disableMouseWheel");
                d.Rf = null != jQuery(e).attr("disableZoom") && "false" != jQuery(e).attr("disableZoom");
                d.Gc = null != jQuery(e).attr("flipSpeed") ? jQuery(e).attr("flipSpeed").toLowerCase() : "medium";
                d.wb = d.wb && !d.Ta;
                d.Mm = null != jQuery(e).attr("bindBindNavigationKeys") && "false" != jQuery(e).attr("bindBindNavigationKeys");
                jQuery(d.toolbar.ea).css("visibility", "hidden");
                if (d.backgroundImage) {
                    d.wp ? (jQuery(d.ra.ia).css("background-color", ""), jQuery(d.ra.ia).css("background", ""), jQuery(d.ra.ka).css({
                        background: "url('" + d.backgroundImage + "')",
                        "background-size": "cover"
                    }), jQuery(d.ra.ia).css("background-size", "cover")) : (jQuery(d.ra.ia).css("background", ""), jQuery(d.ra.ka).css({
                        background: "url('" + d.backgroundImage + "')",
                        "background-color": d.backgroundColor
                    }), jQuery(d.ra.ia).css("background-size", ""), jQuery(d.ra.ia).css("background-position", "center"), jQuery(d.ra.ka).css("background-position", "center"), jQuery(d.ra.ia).css("background-repeat", "no-repeat"), jQuery(d.ra.ka).css("background-repeat", "no-repeat"));
                } else {
                    if (d.backgroundColor && -1 == d.backgroundColor.indexOf("[")) {
                        var f = Q(d.backgroundColor),
                            f = "rgb(" + f.r + "," + f.g + "," + f.b + ")";
                        jQuery(d.ra.ia).css("background", f);
                        jQuery(d.ra.ka).css("background", f);
                        d.ra.ac || jQuery(d.Xb).css("background", f);
                    } else {
                        if (d.backgroundColor && 0 <= d.backgroundColor.indexOf("[")) {
                            var m = d.backgroundColor.split(",");
                            m[0] = m[0].toString().replace("[", "");
                            m[0] = m[0].toString().replace("]", "");
                            m[0] = m[0].toString().replace(" ", "");
                            m[1] = m[1].toString().replace("[", "");
                            m[1] = m[1].toString().replace("]", "");
                            m[1] = m[1].toString().replace(" ", "");
                            f = m[0].toString().substring(0, m[0].toString().length);
                            m = m[1].toString().substring(0, m[1].toString().length);
                            jQuery(d.ra.ia).css("background", "");
                            jQuery(d.ra.ka).css({
                                background: "linear-gradient(" + f + ", " + m + ")"
                            });
                            jQuery(d.ra.ka).css({
                                background: "-webkit-linear-gradient(" + f + ", " + m + ")"
                            });
                            eb.browser.msie && 10 > eb.browser.version && (jQuery(d.ra.ia).css("filter", "progid:DXImageTransform.Microsoft.gradient(GradientType=0,startColorStr='" + f + "', endColorStr='" + m + "');"), jQuery(d.ra.ka).css("filter", "progid:DXImageTransform.Microsoft.gradient(GradientType=0,startColorStr='" + f + "', endColorStr='" + m + "');"));
                        } else {
                            jQuery(d.ra.ka).css("background-color", "#222222");
                        }
                    }
                }
                d.Rj();
                jQuery(d.toolbar.ea).children().css("display", "none");
                d.Qh = d.wa;
                d.Rh = d.wa;
                d.Kh = d.wa;
                d.wg = d.wa;
                d.Bg = d.wa;
                d.Th = d.wa;
                d.Cg = d.wa;
                d.Uh = d.wa;
                d.Dg = d.wa;
                d.Vh = d.wa;
                d.Eg = d.wa;
                d.Wh = d.wa;
                d.yg = d.wa;
                d.Mh = d.wa;
                d.Ag = d.wa;
                d.Oh = d.wa;
                d.zg = d.wa;
                d.Nh = d.wa;
                d.xg = d.wa;
                d.Lh = d.wa;
                var n = "",
                    u = null,
                    f = 0;
                jQuery(toolbar_el).attr("visible") && "false" == jQuery(toolbar_el).attr("visible") ? d.Jl = !1 : d.Jl = !0;
                !jQuery(toolbar_el).attr("width") || null != jQuery(toolbar_el).attr("width") && 0 <= jQuery(toolbar_el).attr("width").indexOf("%") ? jQuery(d.toolbar.ea).css("width", null) : jQuery(toolbar_el).attr("width") && jQuery(d.toolbar.ea).css("width", parseInt(jQuery(toolbar_el).attr("width")) + 60 + "px");
                jQuery(toolbar_el).attr("backgroundColor") && jQuery(d.toolbar.ea).css("background-color", jQuery(toolbar_el).attr("backgroundColor"));
                jQuery(toolbar_el).attr("borderColor") && jQuery(d.toolbar.ea).css("border-color", jQuery(toolbar_el).attr("borderColor"));
                jQuery(toolbar_el).attr("borderStyle") && jQuery(d.toolbar.ea).css("border-style", jQuery(toolbar_el).attr("borderStyle"));
                jQuery(toolbar_el).attr("borderThickness") && jQuery(d.toolbar.ea).css("border-width", jQuery(toolbar_el).attr("borderThickness"));
                jQuery(toolbar_el).attr("paddingTop") && (jQuery(d.toolbar.ea).css("padding-top", jQuery(toolbar_el).attr("paddingTop") + "px"), f += parseFloat(jQuery(toolbar_el).attr("paddingTop")));
                jQuery(toolbar_el).attr("paddingLeft") && jQuery(d.toolbar.ea).css("padding-left", jQuery(toolbar_el).attr("paddingLeft") + "px");
                jQuery(toolbar_el).attr("paddingRight") && jQuery(d.toolbar.ea).css("padding-right", jQuery(toolbar_el).attr("paddingRight") + "px");
                jQuery(toolbar_el).attr("paddingBottom") && (jQuery(d.toolbar.ea).css("padding-bottom", jQuery(toolbar_el).attr("paddingBottom") + "px"), f += parseFloat(jQuery(toolbar_el).attr("paddingTop")));
                jQuery(toolbar_el).attr("cornerRadius") && jQuery(d.toolbar.ea).css({
                    "border-radius": jQuery(toolbar_el).attr("cornerRadius") + "px",
                    "-moz-border-radius": jQuery(toolbar_el).attr("cornerRadius") + "px"
                });
                jQuery(toolbar_el).attr("height") && jQuery(d.toolbar.ea).css("height", parseFloat(jQuery(toolbar_el).attr("height")) - f + "px");
                jQuery(toolbar_el).attr("location") && "float" == jQuery(toolbar_el).attr("location") && (d.wh = !0);
                jQuery(toolbar_el).attr("location") && "bottom" == jQuery(toolbar_el).attr("location") && (d.vh = !0, jQuery(d.toolbar.ea).parent().detach().insertAfter(d.ia), jQuery(d.toolbar.ea).css("margin-top", "15px"), jQuery(d.toolbar.ea + "_wrap").css("bottom", "0px"), jQuery(jQuery(d.aa.ia).css("height", jQuery(d.aa.ia).height() - 40 + "px")));
                var v = 1 < eb.platform.rd && !eb.platform.touchonlydevice ? "@2x" : "";
                jQuery(jQuery(d.Jc).find(c)).find("toolbar").find("element").each(function() {
                    "bttnPrint" != jQuery(this).attr("id") && "bttnDownload" != jQuery(this).attr("id") && "bttnTextSelect" != jQuery(this).attr("id") && "bttnHand" != jQuery(this).attr("id") && "barCursorTools" != jQuery(this).attr("id") || !d.readOnly || jQuery(this).attr("visible", !1);
                    "bttnDownload" != jQuery(this).attr("id") || d.aa.document.PDFFile || jQuery(this).attr("visible", !1);
                    "bttnDownload" == jQuery(this).attr("id") && d.ra.renderer.config.signature && 0 < d.ra.renderer.config.signature.length && jQuery(this).attr("visible", !1);
                    if (!jQuery(this).attr("visible") || "true" == jQuery(this).attr("visible")) {
                        switch (jQuery(this).attr("type")) {
                            case "button":
                                n = ".flowpaper_" + jQuery(this).attr("id");
                                jQuery(this).attr("paddingLeft") && jQuery(n).css("padding-left", jQuery(this).attr("paddingLeft") - 6 + "px");
                                if (0 == jQuery(n).length && (jQuery(d.toolbar.ea).append(String.format("<img id='{0}' class='{1} flowpaper_tbbutton'/>", jQuery(this).attr("id"), "flowpaper_" + jQuery(this).attr("id"))), jQuery(this).attr("onclick"))) {
                                    var c = jQuery(this).attr("onclick");
                                    jQuery(n).bind("mousedown", function() {
                                        eval(c);
                                    });
                                }
                                var e = jQuery(this).attr("id");
                                jQuery(this).attr("src") && (e = jQuery(this).attr("src"));
                                jQuery(n).load(function() {
                                    jQuery(this).css("display", "block");
                                });
                                jQuery(n).attr("src", d.Kk + e + v + ".png");
                                jQuery(this).attr("icon_width") && jQuery(n).css("width", jQuery(this).attr("icon_width") + "px");
                                jQuery(this).attr("icon_height") && jQuery(n).css("height", jQuery(this).attr("icon_height") + "px");
                                jQuery(this).attr("paddingRight") && jQuery(n).css("padding-right", jQuery(this).attr("paddingRight") - 6 + "px");
                                jQuery(this).attr("paddingTop") && jQuery(n).css("padding-top", jQuery(this).attr("paddingTop") + "px");
                                d.wh ? jQuery(n).css("margin-top", "0px") : jQuery(n).css("margin-top", "2px");
                                null != u && jQuery(n).insertAfter(u);
                                u = jQuery(n);
                                break;
                            case "separator":
                                n = "#" + d.toolbar.Ya + "_" + jQuery(this).attr("id");
                                jQuery(n).css("display", "block");
                                jQuery(n).attr("src", d.Kk + "/bar" + v + ".png");
                                jQuery(this).attr("width") && jQuery(n).css("width", jQuery(this).attr("width") + "px");
                                jQuery(this).attr("height") && jQuery(n).css("height", jQuery(this).attr("height") + "px");
                                jQuery(this).attr("paddingLeft") && jQuery(n).css("padding-left", +jQuery(this).attr("paddingLeft"));
                                jQuery(this).attr("paddingRight") && jQuery(n).css("padding-right", +jQuery(this).attr("paddingRight"));
                                jQuery(this).attr("paddingTop") && jQuery(n).css("padding-top", +jQuery(this).attr("paddingTop"));
                                jQuery(n).css("margin-top", "0px");
                                null != u && jQuery(n).insertAfter(u);
                                u = jQuery(n);
                                break;
                            case "slider":
                                n = ".flowpaper_" + jQuery(this).attr("id");
                                jQuery(n).css("display", "block");
                                jQuery(this).attr("width") && jQuery(n).css("width : " + jQuery(this).attr("width"));
                                jQuery(this).attr("height") && jQuery(n).css("height : " + jQuery(this).attr("height"));
                                jQuery(this).attr("paddingLeft") && jQuery(n).css("padding-left : " + jQuery(this).attr("paddingLeft"));
                                jQuery(this).attr("paddingRight") && jQuery(n).css("padding-right : " + jQuery(this).attr("paddingRight"));
                                jQuery(this).attr("paddingTop") && jQuery(n).css("padding-top : " + jQuery(this).attr("paddingTop"));
                                d.wh ? jQuery(n).css("margin-top", "-5px") : jQuery(n).css("margin-top", "-3px");
                                null != u && jQuery(n).insertAfter(u);
                                u = jQuery(n);
                                break;
                            case "textinput":
                                n = ".flowpaper_" + jQuery(this).attr("id");
                                jQuery(n).css("display", "block");
                                jQuery(this).attr("width") && jQuery(n).css("width : " + jQuery(this).attr("width"));
                                jQuery(this).attr("height") && jQuery(n).css("height : " + jQuery(this).attr("height"));
                                jQuery(this).attr("paddingLeft") && jQuery(n).css("padding-left : " + jQuery(this).attr("paddingLeft"));
                                jQuery(this).attr("paddingRight") && jQuery(n).css("padding-right : " + jQuery(this).attr("paddingRight"));
                                jQuery(this).attr("paddingTop") && jQuery(n).css("padding-top : " + jQuery(this).attr("paddingTop"));
                                jQuery(this).attr("readonly") && "true" == jQuery(this).attr("readonly") && jQuery(n).attr("disabled", "disabled");
                                null != u && jQuery(n).insertAfter(u);
                                eb.platform.touchonlydevice ? jQuery(n).css("margin-top", jQuery(this).attr("marginTop") ? jQuery(this).attr("marginTop") + "px" : "7px") : d.wh ? jQuery(n).css("margin-top", "-2px") : jQuery(n).css("margin-top", "0px");
                                u = jQuery(n);
                                break;
                            case "label":
                                n = ".flowpaper_" + jQuery(this).attr("id"), jQuery(n).css("display", "block"), jQuery(this).attr("width") && jQuery(n).css("width : " + jQuery(this).attr("width")), jQuery(this).attr("height") && jQuery(n).css("height : " + jQuery(this).attr("height")), jQuery(this).attr("paddingLeft") && jQuery(n).css("padding-left : " + jQuery(this).attr("paddingLeft")), jQuery(this).attr("paddingRight") && jQuery(n).css("padding-right : " + jQuery(this).attr("paddingRight")), jQuery(this).attr("paddingTop") && jQuery(n).css("padding-top : " + jQuery(this).attr("paddingTop")), null != u && jQuery(n).insertAfter(u), eb.platform.touchonlydevice ? jQuery(n).css("margin-top", jQuery(this).attr("marginTop") ? jQuery(this).attr("marginTop") + "px" : "9px") : d.wh ? jQuery(n).css("margin-top", "1px") : jQuery(n).css("margin-top", "3px"), u = jQuery(n);
                        }
                    }
                });
                d.ra.outline = jQuery(jQuery(d.Jc).find("outline"));
                d.ra.labels = jQuery(jQuery(d.Jc).find("labels"));
                jQuery(d.toolbar.ea).css({
                    "margin-left": "auto",
                    "margin-right": "auto"
                });
                jQuery(toolbar_el).attr("location") && jQuery(toolbar_el).attr("location");
                jQuery(e).attr("glow") && "true" == jQuery(e).attr("glow") && (d.iq = !0, jQuery(d.toolbar.ea).css({
                    "box-shadow": "0 0 35px rgba(22, 22, 22, 1)",
                    "-webkit-box-shadow": "0 0 35px rgba(22, 22, 22, 1)",
                    "-moz-box-shadow": "0 0 35px rgba(22, 22, 22, 1)"
                }));
                d.ec ? jQuery(d.toolbar.ea).css("background-color", d.ec) : eb.platform.touchonlydevice ? !jQuery(toolbar_el).attr("gradients") || jQuery(toolbar_el).attr("gradients") && "true" == jQuery(toolbar_el).attr("gradients") ? jQuery(d.toolbar.ea).addClass("flowpaper_toolbarios_gradients") : jQuery(d.toolbar.ea).css("background-color", "#555555") : jQuery(d.toolbar.ea).css("background-color", "#555555");
                d.Jl ? jQuery(d.toolbar.ea).css("visibility", "visible") : jQuery(d.toolbar.ea).hide();
                jQuery(jQuery(d.Jc).find("content")).find("page").each(function() {
                    var c = jQuery(this);
                    jQuery(this).find("link").each(function() {
                        d.aa.addLink(jQuery(c).attr("number"), jQuery(this).attr("href"), jQuery(this).attr("x"), jQuery(this).attr("y"), jQuery(this).attr("width"), jQuery(this).attr("height"));
                    });
                    jQuery(this).find("video").each(function() {
                        d.aa.addVideo(jQuery(c).attr("number"), jQuery(this).attr("src"), jQuery(this).attr("url"), jQuery(this).attr("x"), jQuery(this).attr("y"), jQuery(this).attr("width"), jQuery(this).attr("height"), jQuery(this).attr("maximizevideo"));
                    });
                    jQuery(this).find("image").each(function() {
                        d.aa.addImage(jQuery(c).attr("number"), jQuery(this).attr("src"), jQuery(this).attr("x"), jQuery(this).attr("y"), jQuery(this).attr("width"), jQuery(this).attr("height"), jQuery(this).attr("href"), jQuery(this).attr("hoversrc"));
                    });
                });
                d.Mm && jQuery(window).bind("keydown", function(c) {
                    !c || Mouse.down || jQuery(c.target).hasClass("flowpaper_zoomSlider") || (d.ra.pages.Zd() || d.ra.pages && d.ra.pages.animating) && !d.Ng || ("37" == c.keyCode ? d.ra.previous() : "39" == c.keyCode && d.ra.next());
                });
                d.Jj = !0;
                d.aa.Gg && d.aa.Gg();
            }
        }) : d.Pj(), d.ra.PreviewMode && (d.Hk(), d.Wg()));
    };
    this.Wg = function() {
        this.aa.ka.find(".flowpaper_fisheye").hide();
    };
    this.rj = function() {
        this.ek();
    };
    this.Hk = function() {
        jQuery(this.ra.ia).css("padding-top", "20px");
        jQuery("#" + this.Ya).hide();
    };
    this.Xo = function() {
        jQuery(this.ra.ia).css("padding-top", "0px");
        jQuery("#" + this.Ya).show();
    };
    this.Pj = function() {
        this.Ta = eb.platform.Ib && !this.ra.PreviewMode;
        this.We = !0;
        this.Sf = !eb.platform.touchonlydevice;
        this.hg = 1;
        this.aa.Uf = !0;
        jQuery(this.toolbar.ea).css({
            "border-radius": "3px",
            "-moz-border-radius": "3px"
        });
        jQuery(this.toolbar.ea).css({
            "margin-left": "auto",
            "margin-right": "auto"
        });
        this.ra.config.document.PanelColor && (this.ec = this.ra.config.document.PanelColor);
        this.ra.config.document.BackgroundColor ? this.backgroundColor = this.ra.config.document.BackgroundColor : this.backgroundColor = "#222222";
        this.backgroundImage || jQuery(this.ra.ka).css("background-color", this.backgroundColor);
        this.ec ? jQuery(this.toolbar.ea).css("background-color", this.ec) : eb.platform.touchonlydevice ? jQuery(this.toolbar.ea).addClass("flowpaper_toolbarios_gradients") : jQuery(this.toolbar.ea).css("background-color", "#555555");
        this.Rj();
        this.Jj = !0;
        this.aa.Gg && this.aa.Gg();
    };
    this.Rj = function() {
        if (eb.platform.touchonlydevice) {
            var c = eb.platform.Ib ? -5 : -1,
                d = eb.platform.Ib ? 7 : 15,
                f = eb.platform.Ib ? 40 : 60;
            jQuery(this.toolbar.ea).html((this.toolbar.ra.config.document.ViewModeToolsVisible ? String.format("<img src='{0}' style='margin-left:{1}px' class='flowpaper_tbbutton_large flowpaper_twopage flowpaper_tbbutton_pressed flowpaper_bttnBookView flowpaper_viewmode'>", this.Kh, d) + String.format("<img src='{0}' class='flowpaper_bttnSinglePage flowpaper_tbbutton_large flowpaper_singlepage flowpaper_viewmode' style='margin-left:{1}px;'>", this.Bg, c) + String.format("<img src='{0}' style='margin-left:{1}px;' class='flowpaper_tbbutton_large flowpaper_thumbview flowpaper_bttnThumbView flowpaper_viewmode' >", this.Cg, c) + "" : "") + (this.toolbar.ra.config.document.ZoomToolsVisible ? String.format("<img class='flowpaper_tbbutton_large flowpaper_bttnZoomIn' src='{0}' style='margin-left:{1}px;' />", this.Dg, d) + String.format("<img class='flowpaper_tbbutton_large flowpaper_bttnZoomOut' src='{0}' style='margin-left:{1}px;' />", this.Eg, c) + String.format("<img class='flowpaper_tbbutton_large flowpaper_bttnFullscreen' src='{0}' style='margin-left:{1}px;' />", this.yg, c) + "" : "") + (this.toolbar.ra.config.document.NavToolsVisible ? String.format("<img src='{0}' class='flowpaper_tbbutton_large flowpaper_previous flowpaper_bttnPrevPage' style='margin-left:{0}px;'/>", this.Ag, d) + String.format("<input type='text' class='flowpaper_tbtextinput_large flowpaper_currPageNum flowpaper_txtPageNumber' value='1' style='width:{0}px;' />", f) + String.format("<div class='flowpaper_lblTotalPages flowpaper_tblabel_large flowpaper_numberOfPages'> / </div>") + String.format("<img src='{0}' class='flowpaper_bttnPrevNext flowpaper_tbbutton_large flowpaper_next'/>", this.zg) + "" : "") + (this.toolbar.ra.config.document.SearchToolsVisible ? String.format("<input type='text' class='flowpaper_txtSearch flowpaper_tbtextinput_large' style='margin-left:{1}px;width:130px;' />", d) + String.format("<img src='{0}' class='flowpaper_bttnFind flowpaper_find flowpaper_tbbutton_large' style=''/>", this.xg) + "" : ""));
            jQuery(this.toolbar.ea).removeClass("flowpaper_toolbarstd");
            jQuery(this.toolbar.ea).addClass("flowpaper_toolbarios");
            jQuery(this.toolbar.ea).parent().parent().css({
                "background-color": this.backgroundColor
            });
        } else {
            jQuery(this.toolbar.ea).css("margin-top", "15px"), c = this.ra.renderer.config.signature && 0 < this.ra.renderer.config.signature.length, jQuery(this.toolbar.ea).html(String.format("<img style='margin-left:10px;' src='{0}' class='flowpaper_bttnPrint flowpaper_tbbutton print'/>", this.jp) + (this.aa.document.PDFFile && 0 < this.aa.document.PDFFile.length && !c ? String.format("<img src='{0}' class='flowpaper_bttnDownload flowpaper_tbbutton download'/>", this.fp) : "") + String.format("<img src='{0}' id='{1}' class='flowpaper_tbseparator' />", this.Nf, this.Jm) + (this.ra.config.document.ViewModeToolsVisible ? String.format("<img style='margin-left:10px;' src='{1}' class='flowpaper_tbbutton {0} flowpaper_bttnBookView flowpaper_twopage flowpaper_tbbuttonviewmode flowpaper_viewmode' />", "FlipView" == this.ra.Gb ? "flowpaper_tbbutton_pressed" : "", this.tp) + String.format("<img src='{1}' class='flowpaper_tbbutton {0} flowpaper_bttnSinglePage flowpaper_singlepage flowpaper_tbbuttonviewmode flowpaper_viewmode' />", "Portrait" == this.ra.Gb ? "flowpaper_tbbutton_pressed" : "", this.ep) + String.format("<img src='{0}' id='{1}' class='flowpaper_tbseparator' />", this.Nf, this.Lm) : "") + (this.ra.config.document.ZoomToolsVisible ? String.format("<div class='flowpaper_zoomSlider flowpaper_slider' style='background-image:url({1})'><div class='flowpaper_handle' style='{0}'></div></div>", eb.browser.msie && 9 > eb.browser.version ? this.aa.toolbar.Cl : "", "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTIiPjxsaW5lIHgxPSIwIiB5MT0iNiIgeDI9Ijk1IiB5Mj0iNiIgc3R5bGU9InN0cm9rZTojQUFBQUFBO3N0cm9rZS13aWR0aDoxIiAvPjwvc3ZnPg==") + String.format("<input type='text' class='flowpaper_tbtextinput flowpaper_txtZoomFactor' style='width:40px;' />") + String.format("<img style='margin-left:10px;' class='flowpaper_tbbutton flowpaper_bttnFullscreen' src='{0}' />", this.gp) : "") + (this.ra.config.document.NavToolsVisible ? String.format("<img src='{0}' class='flowpaper_tbbutton flowpaper_previous flowpaper_bttnPrevPage'/>", this.ip) + String.format("<input type='text' class='flowpaper_txtPageNumber flowpaper_tbtextinput flowpaper_currPageNum' value='1' style='width:50px;text-align:right;' />") + String.format("<div class='flowpaper_lblTotalPages flowpaper_tblabel flowpaper_numberOfPages'> / </div>") + String.format("<img src='{0}' class='flowpaper_bttnPrevNext flowpaper_tbbutton flowpaper_next'/>", this.kp) + String.format("<img src='{0}' id='{1}' class='flowpaper_tbseparator' />", this.Nf, this.Im) : "") + (this.ra.config.document.CursorToolsVisible ? String.format("<img style='margin-top:5px;margin-left:6px;' src='{0}' class='flowpaper_tbbutton flowpaper_bttnTextSelect'/>", this.sp) + String.format("<img style='margin-top:4px;' src='{0}' class='flowpaper_tbbutton flowpaper_tbbutton_pressed flowpaper_bttnHand'/>", this.hp) + String.format("<img src='{0}' id='{1}' class='flowpaper_tbseparator' />", this.Nf, this.Hm) : "") + (this.ra.config.document.SearchToolsVisible ? String.format("<input id='{0}' type='text' class='flowpaper_tbtextinput flowpaper_txtSearch' style='width:40px;margin-left:4px' />") + String.format("<img src='{0}' class='flowpaper_find flowpaper_tbbutton flowpaper_bttnFind' />", this.vp) : "") + String.format("<img src='{0}' id='{1}' class='flowpaper_tbseparator' />", this.Nf, this.Km));
        }
    };
    this.bindEvents = function() {
        var c = this;
        eb.platform.touchonlydevice ? (jQuery(c.toolbar.ea).find(".flowpaper_bttnPrint").on("mousedown touchstart", function() {
            c.Rh != c.wa && jQuery(this).attr("src", c.Rh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnPrint").on("mouseup touchend", function() {
            c.Qh != c.wa && jQuery(this).attr("src", c.Qh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnBookView").on("mousedown touchstart", function() {
            c.wg != c.wa && jQuery(this).attr("src", c.wg);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnBookView").on("mouseup touchend", function() {
            c.wg != c.wa && jQuery(this).attr("src", c.Kh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnSinglePage").on("mousedown touchstart", function() {
            c.Th != c.wa && jQuery(this).attr("src", c.Th);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnSinglePage").on("mouseup touchend", function() {
            c.Bg != c.wa && jQuery(this).attr("src", c.Bg);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnThumbView").on("mousedown touchstart", function() {
            c.Uh != c.wa && jQuery(this).attr("src", c.Uh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnThumbView").on("mouseup touchend", function() {
            c.Cg != c.wa && jQuery(this).attr("src", c.Cg);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnZoomIn").on("mousedown touchstart", function() {
            c.Vh != c.wa && jQuery(this).attr("src", c.Vh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnZoomIn").on("mouseup touchend", function() {
            c.Dg != c.wa && jQuery(this).attr("src", c.Dg);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnZoomOut").on("mousedown touchstart", function() {
            c.Wh != c.wa && jQuery(this).attr("src", c.Wh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnZoomOut").on("mouseup touchend", function() {
            c.Eg != c.wa && jQuery(this).attr("src", c.Eg);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnFullscreen").on("mousedown touchstart", function() {
            c.Mh != c.wa && jQuery(this).attr("src", c.Mh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnFullscreen").on("mouseup touchend", function() {
            c.yg != c.wa && jQuery(this).attr("src", c.yg);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnPrevPage").on("mousedown touchstart", function() {
            c.Oh != c.wa && jQuery(this).attr("src", c.Oh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnPrevPage").on("mouseup touchend", function() {
            c.Ag != c.wa && jQuery(this).attr("src", c.Ag);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnNextPage").on("mousedown touchstart", function() {
            c.Nh != c.wa && jQuery(this).attr("src", c.Nh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnNextPage").on("mouseup touchend", function() {
            c.zg != c.wa && jQuery(this).attr("src", c.zg);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnFind").on("mousedown touchstart", function() {
            c.Lh != c.wa && jQuery(this).attr("src", c.Lh);
        }), jQuery(c.toolbar.ea).find(".flowpaper_bttnFind").on("mouseup touchend", function() {
            c.xg != c.wa && jQuery(this).attr("src", c.xg);
        })) : (jQuery(c.toolbar.ea).find(".flowpaper_txtSearch").on("focus", function() {
            40 >= jQuery(this).width() && (jQuery(c.toolbar.ea).animate({
                width: jQuery(c.toolbar.ea).width() + 60
            }, 100), jQuery(this).animate({
                width: jQuery(this).width() + 60
            }, 100));
        }), jQuery(c.toolbar.ea).find(".flowpaper_txtSearch").on("blur", function() {
            40 < jQuery(this).width() && (jQuery(c.toolbar.ea).animate({
                width: jQuery(c.toolbar.ea).width() - 60
            }, 100), jQuery(this).animate({
                width: 40
            }, 100));
        }));
        jQuery(c.toolbar.ea).find(".flowpaper_bttnZoomIn").bind("click", function() {
            c.ra.pages.je(!0);
        });
        jQuery(c.toolbar.ea).find(".flowpaper_bttnZoomOut").bind("click", function() {
            c.ra.pages.fd();
        });
        0 == c.aa.ka.find(".flowpaper_socialsharedialog").length && c.aa.ka.prepend(String.format("<div id='modal-socialshare' class='modal-content flowpaper_socialsharedialog' style='overflow:hidden;'><font style='color:#000000;font-size:11px'><img src='{0}' align='absmiddle' />&nbsp;<b>{15}</b></font><div style='width:530px;height:307px;margin-top:5px;padding-top:5px;padding-left:5px;background-color:#ffffff;box-shadow: 0px 2px 10px #aaa'><div style='position:absolute;left:20px;top:42px;color:#000000;font-weight:bold;'>{6}</div><div style='position:absolute;left:177px;top:42px;color:#000000;font-weight:bold;'><hr size='1' style='width:350px'/></div><div style='position:absolute;left:20px;top:62px;color:#000000;font-weight:bold;'><select class='flowpaper_ddlSharingOptions'><option>{7}</option><option>{16}</option></select></div><div style='position:absolute;left:175px;top:62px;color:#000000;font-weight:bold;'><input type='text' readonly style='width:355px;' class='flowpaper_socialsharing_txtUrl' /></div><div style='position:absolute;left:20px;top:102px;color:#000000;font-weight:bold;'>{8}</div><div style='position:absolute;left:177px;top:107px;color:#000000;font-weight:bold;'><hr size='1' style='width:350px'/></div><div style='position:absolute;left:20px;top:118px;color:#000000;font-size:10px;'>{9}</div><div style='position:absolute;left:20px;top:148px;color:#000000;font-weight:bold;'><input type='text' style='width:139px;' value='&lt;{10}&gt;' class='flowpaper_txtPublicationTitle' /></div><div style='position:absolute;left:165px;top:146px;color:#000000;'><img src='{1}' class='flowpaper_socialshare_twitter' style='cursor:pointer;' /></div><div style='position:absolute;left:200px;top:146px;color:#000000;'><img src='{2}' class='flowpaper_socialshare_facebook' style='cursor:pointer;' /></div><div style='position:absolute;left:235px;top:146px;color:#000000;'><img src='{3}' class='flowpaper_socialshare_googleplus' style='cursor:pointer;' /></div><div style='position:absolute;left:270px;top:146px;color:#000000;'><img src='{4}' class='flowpaper_socialshare_tumblr' style='cursor:pointer;' /></div><div style='position:absolute;left:305px;top:146px;color:#000000;'><img src='{5}' class='flowpaper_socialshare_linkedin' style='cursor:pointer;' /></div><div style='position:absolute;left:20px;top:192px;color:#000000;font-weight:bold;'>{11}</div><div style='position:absolute;left:20px;top:208px;color:#000000;font-size:10px;'>{12}</div><div style='position:absolute;left:20px;top:228px;color:#000000;font-size:10px;'><input type='radio' name='InsertCode' class='flowpaper_radio_miniature' checked />&nbsp;{13}&nbsp;&nbsp;&nbsp;&nbsp;<input type='radio' name='InsertCode' class='flowpaper_radio_fullembed' />&nbsp;{14}</div><div style='position:absolute;left:20px;top:251px;color:#000000;font-size:10px;'><textarea class='flowpaper_txtEmbedCode' readonly style='width:507px;height:52px'></textarea></div></div></div>", c.rp, c.qp, c.lp, c.mp, c.pp, c.np, c.aa.toolbar.Ga(c.aa.toolbar.fb, "CopyUrlToPublication", "Copy URL to publication"), c.aa.toolbar.Ga(c.aa.toolbar.fb, "DefaultStartPage", "Default start page"), c.aa.toolbar.Ga(c.aa.toolbar.fb, "ShareOnSocialNetwork", "Share on Social Network"), c.aa.toolbar.Ga(c.aa.toolbar.fb, "ShareOnSocialNetworkDesc", "You can easily share this publication to social networks. Just click on the appropriate button below."), c.aa.toolbar.Ga(c.aa.toolbar.fb, "SharingTitle", "Sharing Title"), c.aa.toolbar.Ga(c.aa.toolbar.fb, "EmbedOnSite", "Embed on Site"), c.aa.toolbar.Ga(c.aa.toolbar.fb, "EmbedOnSiteDesc", "Use the code below to embed this publication to your website."), c.aa.toolbar.Ga(c.aa.toolbar.fb, "EmbedOnSiteMiniature", "Linkable Miniature"), c.aa.toolbar.Ga(c.aa.toolbar.fb, "EmbedOnSiteFull", "Full Publication"), c.aa.toolbar.Ga(c.aa.toolbar.fb, "Share", "Share"), c.aa.toolbar.Ga(c.aa.toolbar.fb, "StartOnCurrentPage", "Start on current page")));
        c.aa.ka.find(".flowpaper_radio_miniature, .flowpaper_radio_fullembed, .flowpaper_ddlSharingOptions").on("change", function() {
            c.yh();
        });
        c.aa.ka.find(".flowpaper_txtPublicationTitle").on("focus", function(c) {
            -1 != jQuery(c.target).val().indexOf("Sharing Title") && jQuery(c.target).val("");
        });
        c.aa.ka.find(".flowpaper_txtPublicationTitle").on("blur", function(c) {
            0 == jQuery(c.target).val().length && jQuery(c.target).val("<Sharing Title>");
        });
        c.aa.ka.find(".flowpaper_txtPublicationTitle").on("keydown", function() {
            c.yh();
        });
        c.yh();
        jQuery(c.toolbar.ea).find(".flowpaper_bttnSocialShare").bind("click", function() {
            c.yh();
            jQuery("#modal-socialshare").css("background-color", "#dedede");
            jQuery("#modal-socialshare").smodal({
                minHeight: 350,
                minWidth: 550,
                appendTo: c.aa.ka
            });
            jQuery("#modal-socialshare").parent().css("background-color", "#dedede");
        });
        jQuery(c.toolbar.ea).find(".flowpaper_bttnBookView").bind("click", function() {
            eb.browser.msie && 8 >= eb.browser.version ? c.ra.switchMode("BookView", c.ra.getCurrPage()) : c.ra.switchMode("FlipView", c.ra.getCurrPage() + 1);
            jQuery(this).addClass("flowpaper_tbbutton_pressed");
        });
        c.aa.ka.find(".flowpaper_socialsharing_txtUrl, .flowpaper_txtEmbedCode").bind("focus", function() {
            jQuery(this).select();
        });
        c.aa.ka.find(".flowpaper_socialsharing_txtUrl, .flowpaper_txtEmbedCode").bind("mouseup", function() {
            return !1;
        });
        c.aa.ka.find(".flowpaper_socialshare_twitter").bind("mousedown", function() {
            window.open("https://twitter.com/intent/tweet?url=" + escape(c.Le(!1)) + "&text=" + escape(c.Tg()), "_flowpaper_exturl");
            c.aa.ia.trigger("onSocialMediaShareClicked", "Twitter");
        });
        c.aa.ka.find(".flowpaper_socialshare_facebook").bind("mousedown", function() {
            window.open("http://www.facebook.com/sharer.php?u=" + escape(c.Le(!1), "_flowpaper_exturl"));
            c.aa.ia.trigger("onSocialMediaShareClicked", "Facebook");
        });
        c.aa.ka.find(".flowpaper_socialshare_googleplus").bind("mousedown", function() {
            window.open("https://plus.google.com/share?url=" + escape(c.Le(!1)), "_flowpaper_exturl");
            c.aa.ia.trigger("onSocialMediaShareClicked", "GooglePlus");
        });
        c.aa.ka.find(".flowpaper_socialshare_tumblr").bind("mousedown", function() {
            window.open("http://www.tumblr.com/share/link?name=" + escape(c.Tg()) + "&url=" + escape(c.Le(!1)), "_flowpaper_exturl");
            c.aa.ia.trigger("onSocialMediaShareClicked", "Tumblr");
        });
        c.aa.ka.find(".flowpaper_socialshare_linkedin").bind("mousedown", function() {
            window.open("http://www.linkedin.com/shareArticle?mini=true&url=" + escape(c.Le(!1)) + "&title=" + escape(c.Tg()), "_flowpaper_exturl");
            c.aa.ia.trigger("onSocialMediaShareClicked", "LinkedIn");
        });
    };
    this.yh = function() {
        this.aa.ka.find(".flowpaper_txtEmbedCode").val('<iframe frameborder="0"  width="400" height="300"  title="' + this.Tg() + '" src="' + this.Le() + '" type="text/html" scrolling="no" marginwidth="0" marginheight="0"></iframe>');
        this.aa.ka.find(".flowpaper_socialsharing_txtUrl").val(this.Le(!1));
    };
    this.Tg = function() {
        return -1 == this.aa.ka.find(".flowpaper_txtPublicationTitle").val().indexOf("Sharing Title") ? this.aa.ka.find(".flowpaper_txtPublicationTitle").val() : "";
    };
    this.Le = function(c) {
        0 == arguments.length && (c = !0);
        var d = this.aa.ka.find(".flowpaper_ddlSharingOptions").prop("selectedIndex"),
            f = this.aa.ka.find(".flowpaper_radio_miniature").is(":checked"),
            l = window.location.href.toString();
        this.aa.document.SharingUrl && (l = this.aa.document.SharingUrl);
        return l.substring(0) + (0 < d ? "#page=" + this.aa.getCurrPage() : "") + (0 < d && f && c ? "&" : f && c ? "#" : "") + (f && c ? "PreviewMode=Miniature" : "");
    };
    this.initialize = function() {
        var c = this.aa;
        c.ca.wb = c.ca.ai();
        c.ca.Ng = !1;
        c.ca.wb || (c.renderer.Hg = !0);
        eb.platform.ios && 8 > eb.platform.iosversion && (c.ca.wb = !1);
        if (!c.config.document.InitViewMode || c.config.document.InitViewMode && "Zine" == c.config.document.InitViewMode || "TwoPage" == c.config.document.InitViewMode || "Flip-SinglePage" == c.config.document.InitViewMode) {
            "Flip-SinglePage" != c.config.document.InitViewMode || (eb.platform.Ib || eb.platform.ios || eb.platform.android) && eb.browser.Hi || (c.gf = !0), c.Gb = "FlipView", c.config.document.MinZoomSize = 1, c.ba = c.Gb, "TwoPage" == c.ba && (c.ba = "FlipView"), c.scale = 1;
        }
        c.config.document.Vk = c.config.document.MinZoomSize;
        null === c.ka && (c.ka = jQuery("<div style='" + c.ia.attr("style") + ";margin-bottom;20px;overflow-x: hidden;overflow-y: hidden;' class='flowpaper_viewer_container'/>"), c.ka = c.ia.wrap(c.ka).parent(), c.ia.css({
            left: "0px",
            top: "0px",
            position: "relative",
            width: "100%",
            height: "100%"
        }).addClass("flowpaper_viewer"), eb.browser.safari && c.ia.css("-webkit-transform", "translateZ(0)"));
        jQuery(c.ia).bind("onCurrentPageChanged", function() {
            c.fisheye && c.Qm();
        });
    };
    this.Ap = function(d) {
        eb.platform.touchonlydevice ? c.switchMode("SinglePage", d) : c.switchMode("Portrait", d);
    };
    FlowPaperViewer_HTML.prototype.dl = function(c) {
        var d = this;
        if (d.Wb != c) {
            var f = (c - 20 + 1) / 2,
                l = f + 9 + 1,
                k = 1,
                m = null != d.ca.ec ? d.ca.ec : "#555555";
            d.fisheye.find(".flowpaper_fisheye_item").parent().parent().remove();
            0 > d.getTotalPages() - c && (l = l + (d.getTotalPages() - c) / 2 + (c - d.getTotalPages()) % 2);
            19 < c ? d.fisheye.find(".flowpaper_fisheye_panelLeft").animate({
                opacity: 1
            }, 150) : d.fisheye.find(".flowpaper_fisheye_panelLeft").animate({
                opacity: 0
            }, 150);
            c < d.getTotalPages() ? d.fisheye.find(".flowpaper_fisheye_panelRight").animate({
                opacity: 1
            }, 150) : d.fisheye.find(".flowpaper_fisheye_panelRight").animate({
                opacity: 0
            }, 150);
            for (i = f; i < l; i++) {
                d.Bm(k), k++;
            }
            d.fisheye.find(".flowpaper_fisheye_item, .flowpaper_fisheye_panelLeft, .flowpaper_fisheye_panelRight").bind("mouseover", function() {
                if (!d.pages.animating && 0 != d.fisheye.css("opacity")) {
                    var c = (1 - Math.min(1, Math.max(0, 1 / d.rk))) * d.pk + d.$b;
                    d.fisheye.css({
                        "z-index": 12,
                        "pointer-events": "auto"
                    });
                    jQuery(this).parent().parent().parent().find("span").css({
                        display: "none"
                    });
                    jQuery(this).parent().find("span").css({
                        display: "inline-block"
                    });
                    jQuery(this).parent().parent().parent().find("p").remove();
                    var e = jQuery(this).context.dataset && 1 == jQuery(this).context.dataset.pageindex ? d.Og / 3 : 0;
                    jQuery(this).parent().find("span").after(String.format("<p style='width: 0;height: 0;border-left: 7px solid transparent;border-right: 7px solid transparent;border-top: 7px solid {0};margin-top:-35px;margin-left:{1}px;'></p>", m, c / 2 - 14 + e));
                }
            });
            d.fisheye.find(".flowpaper_fisheye_item").bind("mouseout", function(c) {
                d.pages.animating || 0 == d.fisheye.css("opacity") || (d.si = c.pageX, d.ti = c.pageY, d.fe = c.target, jQuery(d.fe).get(0), d.Bl(), d.fisheye.css({
                    "z-index": 9,
                    "pointer-events": "none"
                }), jQuery(this).parent().find("span").css({
                    display: "none"
                }), jQuery(this).parent().find("p").remove());
            });
            d.fisheye.find("li").each(function() {
                jQuery(this).bind("mousemove", function(c) {
                    d.pages.animating || 0 < c.buttons || !d.fisheye.is(":visible") || (d.fe = c.target, d.si = c.pageX, d.ti = c.pageY, jQuery(d.fe).get(0), d.ui = !0, d.al());
                });
            });
            jQuery(d.pages.da + ", " + d.pages.da + "_parent, #" + d.ja).bind("mouseover", function() {
                if (d.fisheye && (d.fisheye.css({
                        "z-index": 9,
                        "pointer-events": "none"
                    }), (eb.browser.msie || eb.browser.safari && 5 > eb.browser.Hb) && d.fe)) {
                    d.fe = null;
                    var c = d.fisheye.find("a").find("canvas").data("origwidth"),
                        e = d.fisheye.find("a").find("canvas").data("origheight");
                    d.fisheye.find("li").each(function() {
                        jQuery(this).find("a").css({
                            height: e,
                            width: c,
                            top: d.$b / 3
                        });
                        jQuery(this).find("a").find("canvas").css({
                            height: e,
                            width: c,
                            top: d.$b / 3
                        });
                    });
                }
            });
        }
        d.Wb = c;
    };
    FlowPaperViewer_HTML.prototype.Qm = function() {
        (this.ua > this.Wb || this.ua <= this.Wb - 20) && -1 != this.Wb && this.$g(this.ua > this.Wb ? 20 : -20);
    };
    FlowPaperViewer_HTML.prototype.$g = function(c) {
        var d = this;
        0 != c && d.dl(d.Wb + c);
        window.setTimeout(function() {
            d.Se = (d.Wb - 20 + 1) / 2 + 1;
            d.xj = d.Se + 9;
            0 > d.getTotalPages() - d.Wb && (d.xj = d.xj + (d.getTotalPages() - d.Wb) / 2 + (d.Wb - d.getTotalPages()) % 2);
            d.renderer.Ke(d, d.Se, 2 * d.ee);
        }, 300);
    };
    FlowPaperViewer_HTML.prototype.Bm = function(c) {
        var d = 0 == i ? 1 : 2 * i + 1,
            f = this;
        if (f.fisheye) {
            var l = null != f.ca.ec ? f.ca.ec : "#555555",
                k = "";
            1 == d ? k = "&nbsp;&nbsp;" + c + "&nbsp;&nbsp;" : d == f.getTotalPages() && 0 == f.getTotalPages() % 2 ? k = (d - 1).toString() : k = d - 1 + "-" + d;
            c = jQuery(String.format("<li><a style='height:{2}px;width:{7}px;top:{9}px;' class='flowpaper_thumbitem'><span style='margin-left:{8}px;background-color:{0}'>{4}</span><canvas data-pageIndex='{5}' data-ThumbIndex='{6}' class='flowpaper_fisheye_item' style='pointer-events: auto;' /></a></li>", l, f.ef, 0.8 * f.ee, f.Og, k, d, c, f.$b, 1 == d ? f.Og : 0, f.$b / 3));
            c.insertBefore(f.fisheye.find(".flowpaper_fisheye_panelRight").parent());
            c.find(".flowpaper_fisheye_item").css({
                opacity: 0
            });
            jQuery(c).bind("mousedown", function() {
                1 != !f.scale && (f.fisheye && f.fisheye.css({
                    "z-index": 9,
                    "pointer-events": "none"
                }), d > f.getTotalPages() && (d = f.getTotalPages()), f.gotoPage(d));
            });
        }
    };
    this.ek = function() {
        var c = this.aa;
        0 < c.ka.find(".flowpaper_fisheye").length && c.ka.find(".flowpaper_fisheye").remove();
        c.Wb = -1;
        var d = 0;
        0 < c.getDimensions(0).length && (d = c.getDimensions(0)[0].Ca / c.getDimensions(0)[0].Na - 0.3);
        c.Sq = 25;
        c.ee = 0.25 * c.ia.height();
        c.Og = 0.41 * c.ee;
        c.ef = jQuery(c.ia).offset().top + jQuery(c.pages.da).height() - c.ka.offset().top + c.hc;
        c.rk = 1.25 * c.ee;
        c.$b = c.ee / (3.5 - d);
        // QUI PER LO ZOOM DELLE PREVIEW
        c.pn = 1.2 * c.$b;
        // FINE ZOOM DELLE PREVIEW
        c.qn = -(c.$b / 3);
        d = null != c.ca.ec ? c.ca.ec : "#555555";
        c.ca.hg && (d = Q(d), d = "rgba(" + d.r + "," + d.g + "," + d.b + "," + c.ca.hg + ")");
        c.ka.append(jQuery(String.format("<div class='flowpaper_fisheye' style='position:absolute;pointer-events: none;top:{1}px;z-index:12;left:{4}px;'><ul><li><div class='flowpaper_fisheye_panelLeft' style='pointer-events: auto;position:relative;-moz-border-radius-topleft: 10px;border-top-left-radius: 10px;-moz-border-radius-bottomleft: 10px;border-bottom-left-radius: 10px;background-color:{0};left:0px;width:22px;'><div style='position:absolute;height:100px;width:100px;left:0px;top:-40px;'></div><div class='flowpaper_fisheye_leftArrow' style='position:absolute;top:20%;left:3px'></div></div></li><li><div class='flowpaper_fisheye_panelRight' style='pointer-events: auto;position:relative;-moz-border-radius-topright: 10px;border-top-right-radius: 10px;-moz-border-radius-bottomright: 10px;border-bottom-right-radius: 10px;background-color:{0};left:0px;width:22px;'><div style='position:absolute;height:100px;width:100px;left:0px;top:-40px;'></div><div class='flowpaper_fisheye_rightArrow' style='position:absolute;top:20%;left:3px;'></div></div></li></ul></div>", d, c.ef, 0.8 * c.ee, c.Og, c.qn)));
        c.fisheye = c.ka.find(".flowpaper_fisheye");
        c.fisheye.css({
            top: c.ef - (c.fisheye.find(".flowpaper_fisheye_panelLeft").offset().top - jQuery(c.fisheye).offset().top) + c.fisheye.find(".flowpaper_fisheye_panelLeft").height() / 2
        });
        c.pk = c.pn - c.$b;
        c.si = -1;
        c.ti = -1;
        c.ni = !1;
        c.ui = !1;
        c.Vf = c.$b - 0.4 * c.$b;
        c.Rq = c.Vf / c.$b;
        c.fisheye.find(".flowpaper_fisheye_panelLeft").bind("mousedown", function() {
            c.$g(-20);
        });
        c.fisheye.find(".flowpaper_fisheye_panelRight").bind("mousedown", function() {
            c.$g(20);
        });
        36 < c.Vf && (c.Vf = 36);
        c.fisheye.find(".flowpaper_fisheye_panelLeft").css({
            opacity: 0,
            height: c.Vf + "px",
            top: "-10px"
        });
        c.fisheye.find(".flowpaper_fisheye_panelRight").css({
            height: c.Vf + "px",
            top: "-10px"
        });
        c.fisheye.css({
            top: c.ef - (c.fisheye.find(".flowpaper_fisheye_panelLeft").offset().top - jQuery(c.fisheye).offset().top) + c.fisheye.find(".flowpaper_fisheye_panelLeft").height() / 3
        });
        c.nk = 30 < c.fisheye.find(".flowpaper_fisheye_panelLeft").height() ? 11 : 0.35 * c.fisheye.find(".flowpaper_fisheye_panelLeft").height();
        c.fisheye.find(".flowpaper_fisheye_leftArrow").dj(c.nk, c.ca.$e ? c.ca.$e : "#AAAAAA");
        c.fisheye.find(".flowpaper_fisheye_rightArrow").ej(c.nk, c.ca.$e ? c.ca.$e : "#AAAAAA");
        jQuery(c).unbind("onThumbPanelThumbAdded");
        jQuery(c).bind("onThumbPanelThumbAdded", function(d, g) {
            var f = c.fisheye.find(String.format('*[data-thumbIndex="{0}"]', g.Te));
            f.data("pageIndex");
            var m = (g.Te - 1) % 10;
            f && f.animate({
                opacity: 1
            }, 300);
            c.Se < c.xj && (c.Wb - 20 + 1) / 2 + m + 2 > c.Se && (c.Dp ? (c.Se++, c.Dp = !1) : c.Se = (c.Wb - 20 + 1) / 2 + m + 2, c.renderer.Ke(c, c.Se, 2 * c.ee));
            0 == m && f.height() - 10 < c.fisheye.find(".flowpaper_fisheye_panelRight").height() && (c.fisheye.find(".flowpaper_fisheye_panelLeft").css("top", c.fisheye.find(".flowpaper_fisheye_panelLeft").height() - f.height() + 5 + "px"), c.fisheye.find(".flowpaper_fisheye_panelLeft").height(c.fisheye.find(".flowpaper_fisheye_panelLeft").height() - 3), c.fisheye.find(".flowpaper_fisheye_panelRight").css("top", c.fisheye.find(".flowpaper_fisheye_panelRight").height() - f.height() + 5 + "px"), c.fisheye.find(".flowpaper_fisheye_panelRight").height(c.fisheye.find(".flowpaper_fisheye_panelRight").height() - 3));
        });
        c.dl(19);
        c.PreviewMode || c.$g(0);
        1 != c.scale && c.fisheye.animate({
            opacity: 0
        }, 0);
    };
    this.kh = function() {
        if ("FlipView" == c.ba && window.zine) {
            c.hc = c.ac && !c.ca.vh ? c.ca.Xb.height() : 0;
            c.$d && c.ac && (c.hc = 5);
            c.document.StartAtPage && !c.vg && (c.vg = 0 != c.document.StartAtPage % 2 ? c.document.StartAtPage - 1 : c.document.StartAtPage);
            c.Gf = !1;
            var d = 1400;
            "very fast" == c.ca.Gc && (d = 300);
            "fast" == c.ca.Gc && (d = 700);
            "slow" == c.ca.Gc && (d = 2300);
            "very slow" == c.ca.Gc && (d = 6300);
            c.Ll = 600;
            c.Ea = jQuery(c.pages.da).turn({
                gradients: !eb.platform.android,
                acceleration: !0,
                elevation: 50,
                duration: d,
                page: c.vg ? c.vg : 1,
                display: c.ca.Ta ? "single" : "double",
                pages: c.getTotalPages(),
                cornerDragging: c.document.EnableCornerDragging,
                disableCornerNavigation: c.ca.wb,
                when: {
                    turning: function(d, e) {
                        c.pages.animating = !0;
                        c.pages.Bf = null;
                        c.pages.la = 0 == e % 2 ? e + 1 : e;
                        if (1 != e || c.ca.Ta) {
                            c.ca.Ta ? c.ca.Ta && c.hc && jQuery(c.pages.da + "_parent").transition({
                                x: 0,
                                y: c.hc
                            }, 0) : jQuery(c.pages.da + "_parent").transition({
                                x: 0,
                                y: c.hc
                            }, c.Ll, "ease", function() {});
                        } else {
                            var g = c.Gf ? c.Ll : 0;
                            jQuery(c.pages.da + "_parent").transition({
                                x: -(c.pages.ed() / 4),
                                y: c.hc
                            }, g, "ease", function() {});
                        }
                        c.ua = 1 < e ? c.pages.la : e;
                        c.renderer.ce && c.Gf && c.pages.Ne(e - 1);
                        c.renderer.ce && c.Gf && c.pages.Ne(e);
                        "FlipView" == c.ba && (!c.pages.pages[e - 1] || c.pages.pages[e - 1].qc || c.pages.pages[e - 1].Fa || (c.pages.pages[e - 1].qc = !0, c.pages.pages[e - 1].vd()), e < c.getTotalPages() && c.pages.pages[e] && !c.pages.pages[e].qc && !c.pages.pages[e].Fa && (c.pages.pages[e].qc = !0, c.pages.pages[e].vd()));
                    },
                    turned: function(d, e) {
                        c.ca.wb && c.Ea ? c.pages.Zd() || (c.Ea.css({
                            opacity: 1
                        }), c.yf ? (c.Gf = !0, c.pages.animating = !1, c.dd(e), c.pages.fc(), c.ia.trigger("onCurrentPageChanged", e), null != c.Sd && (c.Sd(), c.Sd = null)) : jQuery("#" + c.pages.Rb).animate({
                            opacity: 0.5
                        }, {
                            duration: 50,
                            always: function() {
                                jQuery("#" + c.pages.Rb).animate({
                                    opacity: 0
                                }, {
                                    duration: 50,
                                    always: function() {
                                        jQuery("#" + c.pages.Rb).css("z-index", -1);
                                        c.Gf = !0;
                                        c.pages.animating = !1;
                                        c.dd(e);
                                        c.pages.fc();
                                        c.ia.trigger("onCurrentPageChanged", e);
                                        null != c.Sd && (c.Sd(), c.Sd = null);
                                    }
                                });
                            }
                        })) : (c.Gf = !0, c.pages.animating = !1, c.dd(e), c.pages.fc(), c.ia.trigger("onCurrentPageChanged", e), null != c.Sd && (c.Sd(), c.Sd = null));
                    },
                    pageAdded: function(d, e) {
                        var g = c.pages.getPage(e - 1);
                        g.On();
                        c.ca.vc.Nn(g);
                    },
                    foldedPageClicked: function(d, e) {
                        c.bj || (c.pages.Zd() || c.pages.animating) && !c.ca.Ng || c.cb || c.Kb || requestAnim(function() {
                            window.clearTimeout(c.yf);
                            c.yf = null;
                            e >= c.pages.la && e < c.getTotalPages() ? c.pages.zj("next") : c.pages.zj("previous");
                        });
                    },
                    destroyed: function() {
                        c.$m && c.ia.parent().remove();
                    }
                }
            });
            jQuery(c.Ea).bind("cornerActivated", function() {
                c.fisheye && c.fisheye.css({
                    "z-index": 9,
                    "pointer-events": "none"
                });
            });
            jQuery(c.ea).trigger("onScaleChanged", 1 / c.document.MaxZoomSize);
        }
        if (c.backgroundColor && -1 == c.backgroundColor.indexOf("[") && !this.backgroundImage) {
            d = Q(this.backgroundColor), d = "rgba(" + d.r + "," + d.g + "," + d.b + "," + (null != this.Yj ? parseFloat(this.Yj) : 1) + ")", jQuery(this.ra.ia).css("background", d), this.ra.ac || jQuery(this.Xb).css("background", d);
        } else {
            if (c.backgroundColor && 0 <= c.backgroundColor.indexOf("[") && !this.backgroundImage) {
                var g = c.backgroundColor.split(",");
                g[0] = g[0].toString().replace("[", "");
                g[0] = g[0].toString().replace("]", "");
                g[0] = g[0].toString().replace(" ", "");
                g[1] = g[1].toString().replace("[", "");
                g[1] = g[1].toString().replace("]", "");
                g[1] = g[1].toString().replace(" ", "");
                d = g[0].toString().substring(0, g[0].toString().length);
                g = g[1].toString().substring(0, g[1].toString().length);
                jQuery(c.ra.ia).css("backgroundImage", "linear-gradient(top, " + d + ", " + g + ")");
            }
        }
        "FlipView" == c.ba && !eb.platform.touchonlydevice && c.ca.rj && c.ca.Sf ? (c.ca.ek(), c.PreviewMode && c.ca.Wg()) : (c.fisheye && (c.fisheye.remove(), c.fisheye = null), c.Wb = -1);
        FlowPaperViewer_HTML.prototype.distance = function(c, d, e, g) {
            c = e - c;
            d = g - d;
            return Math.sqrt(c * c + d * d);
        };
        FlowPaperViewer_HTML.prototype.turn = function(c) {
            var d = this,
                e = arguments[0],
                g = 2 == arguments.length ? arguments[1] : null;
            !d.ca.wb || "next" != e && "previous" != e || d.cb || d.Kb ? (jQuery("#" + d.pages.Rb).css("z-index", -1), d.Ea && (1 == arguments.length && d.Ea.turn(arguments[0]), 2 == arguments.length && d.Ea.turn(arguments[0], arguments[1]))) : !d.pages.Zd() && !d.pages.animating || d.ca.Ng ? requestAnim(function() {
                window.clearTimeout(d.yf);
                d.yf = null;
                d.pages.zj(e, g);
            }) : (window.clearTimeout(d.yf), d.yf = window.setTimeout(function() {
                d.turn(e, g);
            }, 500));
        };
        FlowPaperViewer_HTML.prototype.al = function() {
            var c = this;
            c.ni || (c.ni = !0, c.mk && window.clearTimeout(c.mk), c.mk = window.setTimeout(function() {
                c.nn(c);
            }, 40));
        };
        FlowPaperViewer_HTML.prototype.nn = function(c) {
            c.Bl();
            c.ni = !1;
            c.ui && (c.ui = !1, c.al());
        };
        FlowPaperViewer_HTML.prototype.Bl = function() {
            var c = this;
            c.fisheye.find("li").each(function() {
                var d = c.fe;
                if (!(eb.browser.msie || eb.browser.safari && 5 > eb.browser.Hb) || c.fe) {
                    if ("IMG" != jQuery(d).get(0).tagName && "DIV" != jQuery(d).get(0).tagName && "CANVAS" != jQuery(d).get(0).tagName) {
                        c.fisheye.find("li").each(function() {
                            var d = this;
                            requestAnim(function() {
                                jQuery(d).find("a").css({
                                    width: c.$b,
                                    top: c.$b / 3
                                });
                            }, 10);
                        });
                    } else {
                        var d = jQuery(this).offset().left + jQuery(this).outerWidth() / 2,
                            e = jQuery(this).offset().top + jQuery(this).outerHeight() / 2,
                            d = c.distance(d, e, c.si, c.ti),
                            g = (1 - Math.min(1, Math.max(0, d / c.rk))) * c.pk + c.$b,
                            d = jQuery(this).find("a").find("canvas").data("origwidth"),
                            e = jQuery(this).find("a").find("canvas").data("origheight"),
                            f = g / d;
                        if (d && e) {
                            var u = this;
                            eb.browser.msie || eb.browser.safari && 5 > eb.browser.Hb ? (jQuery(this).find("a").animate({
                                height: e * f,
                                width: g,
                                top: g / 3
                            }, 0), jQuery(this).find("a").find("canvas").css({
                                height: e * f,
                                width: g,
                                top: g / 3
                            }), c.pr = c.fe) : requestAnim(function() {
                                jQuery(u).find("a").css({
                                    width: g,
                                    top: g / 3
                                });
                            }, 10);
                        }
                    }
                }
            });
        };
        jQuery(c.toolbar.ea).css("visibility", "visible");
        c.fisheye && c.fisheye.css({
            "z-index": 9,
            "pointer-events": "none"
        });
        c.ca.Xb.animate({
            opacity: 1
        }, 300);
    };
    this.dispose = function() {
        c.Ea.turn("destroy");
        delete c.Ea;
    };
    this.kg = function() {
        c.Ea = null;
    };
    this.switchMode = function(d, g) {
        c.Ea && c.Ea.turn("destroy");
        c.Ea = null;
        "Portrait" == d || "SinglePage" == d ? (c.Od = c.ia.height(), c.Od = c.Od - jQuery(c.ea).outerHeight() + 20, c.ia.height(c.Od)) : (c.vg = 0 != g % 2 ? g - 1 : g, c.Od = null, c.ia.css({
            left: "0px",
            top: "0px",
            position: "relative",
            width: "100%",
            height: "100%"
        }), c.Uj());
        "FlipView" == c.ba && "FlipView" != d && (c.config.document.MinZoomSize = 1, jQuery(c.pages.da).turn("destroy"), c.fisheye && c.fisheye.remove());
        c.pages.Ud && c.pages.Kc && c.pages.Kc();
        "FlipView" != d && c.config.document.Vk && (c.config.document.MinZoomSize = c.config.document.Vk);
        "FlipView" == d && (c.scale = 1, c.ba = "FlipView", c.ca.wb = c.ca.ai());
    };
    this.ai = function() {
        return c.config.document.EnableWebGL && !eb.platform.Ib && !eb.platform.android && !eb.browser.Hi && !c.ca.Ta && eb.browser.rb.Np && "Flip-SinglePage" != c.config.document.InitViewMode && window.THREE;
    };
    this.gotoPage = function(d, g) {
        "FlipView" == c.ba && c.pages.En(d, g);
    };
    this.dd = function(d) {
        if ("FlipView" == c.ba) {
            1 < c.pages.la && 1 == c.scale ? jQuery(c.pages.da + "_panelLeft").animate({
                opacity: 1
            }, 100) : 1 == c.pages.la && jQuery(c.pages.da + "_panelLeft").animate({
                opacity: 0
            }, 100);
            if (c.pages.la <= c.getTotalPages() && 1.1 >= c.scale) {
                1 < c.getTotalPages() && jQuery(c.pages.da + "_panelRight").animate({
                    opacity: 1
                }, 100), c.fisheye && "1" != c.fisheye.css("opacity") && window.setTimeout(function() {
                    1.1 >= c.scale && (c.fisheye.show(), c.fisheye.animate({
                        opacity: 1
                    }, 100));
                }, 700);
            } else {
                if (1.1 < c.scale || c.pages.la + 2 >= c.getTotalPages()) {
                    jQuery(c.pages.da + "_panelRight").animate({
                        opacity: 0
                    }, 100), 1 == c.scale && 0 == c.getTotalPages() % 2 && c.pages.la - 1 <= c.getTotalPages() ? c.fisheye && (c.fisheye.show(), c.fisheye.animate({
                        opacity: 1
                    }, 100)) : c.fisheye && c.fisheye.animate({
                        opacity: 0
                    }, 0, function() {
                        c.fisheye.hide();
                    });
                }
            }
            eb.platform.touchonlydevice || (window.clearTimeout(c.Tn), c.Tn = setTimeout(function() {
                0 != parseInt(d) % 2 && (d = d - 1);
                var g = [d - 1];
                1 < d && parseInt(d) + 1 <= c.document.numPages && !c.Ta && g.push(d);
                for (var f = 0; f < g.length; f++) {
                    jQuery(".flowpaper_mark_link, .pdfPageLink_" + g[f]).stop(), jQuery(".flowpaper_mark_link, .pdfPageLink_" + g[f]).css({
                        background: c.linkColor,
                        opacity: c.ke
                    }), jQuery(".flowpaper_mark_link, .pdfPageLink_" + g[f]).animate({
                        opacity: 0
                    }, {
                        duration: 1700,
                        complete: function() {}
                    });
                }
            }, 100));
        }
    };
    this.tj = function() {
        this.aa.fisheye && (this.qk = this.aa.fisheye.css("margin-left"), this.aa.fisheye.animate({
            "margin-left": parseFloat(this.aa.fisheye.css("margin-left")) + 0.5 * this.aa.cb.width() + "px"
        }, 200));
    };
    this.Wo = function() {
        this.aa.fisheye && (this.qk = this.aa.fisheye.css("margin-left"), this.aa.fisheye.animate({
            "margin-left": parseFloat(this.aa.fisheye.css("margin-left")) + 0.5 * this.aa.Kb.width() + "px"
        }, 200));
    };
    this.rf = function() {
        this.aa.fisheye && this.aa.fisheye.animate({
            "margin-left": parseFloat(this.qk) + "px"
        }, 200);
    };
    this.resize = function(d, g, f, l) {
        c.hc = c.ac ? c.ca.Xb.height() : 0;
        if ("FlipView" == c.ba && c.pages) {
            c.ia.css({
                width: d,
                height: g - 35
            });
            d = c.ia.width();
            g = c.ia.height();
            d - 5 < jQuery(document.body).width() && d + 5 > jQuery(document.body).width() && g + 37 - 5 < jQuery(document.body).height() && g + 37 + 5 > jQuery(document.body).height() ? (c.ka.css({
                width: "100%",
                height: "100%"
            }), c.ca.vh && jQuery(jQuery(c.ia).css("height", jQuery(c.ia).height() - 40 + "px"))) : null != f && 1 != f || c.ka.css({
                width: d,
                height: g + 37
            });
            c.pages.resize(d, g, l);
            c.fisheye && c.ia && (c.ef = jQuery(c.ia).offset().top + jQuery(c.pages.da).height() - jQuery(c.ka).offset().top + c.hc, c.fisheye.css({
                top: c.ef - (c.fisheye.find(".flowpaper_fisheye_panelLeft").offset().top - jQuery(c.fisheye).offset().top) + c.fisheye.find(".flowpaper_fisheye_panelLeft").height() / 2
            }), c.ee = 0.25 * c.ia.height());
            for (d = 0; d < c.document.numPages; d++) {
                c.pages.kb(d) && (c.pages.pages[d].ol = !0, c.pages.pages[d].Fa = !1);
            }
            window.clearTimeout(c.Op);
            c.Op = setTimeout(function() {
                c.fc();
                c.pages.La();
            }, 350);
        }
    };
    this.setCurrentCursor = function() {};
};
window.FlowPaper_Resources = function(f) {
    this.aa = f;
    this.xa = {};
    this.xa.Pp = "";
    this.xa.rm = "";
    this.xa.nm = "";
    this.xa.$l = "";
    this.xa.qm = "";
    this.xa.um = "";
    this.xa.tm = "";
    this.xa.mm = "";
    this.xa.lm = "";
    this.xa.em = "";
    this.xa.Xl = "";
    this.xa.Yl = "";
    this.xa.sm = "";
    this.xa.gm = "";
    this.xa.dm = "";
    this.xa.pm = "";
    this.xa.cq = "";
    this.xa.gq = "";
    this.xa.hq = "";
    this.xa.lq = "";
    this.xa.jq = "";
    this.xa.pq = "";
    this.xa.qq = "";
    this.xa.rq = "";
    this.xa.oq = "";
    this.xa.sq = "";
    this.qo = function() {
        var c = this.aa,
            d = !0,
            d = d = "",
            d = ["Z1n3d0ma1n"],
            d = d[0],
            d = c.resources.Rl(d);
        d || (d = ["d0ma1n"], d = d[0] + "#FlexPaper-1-4-5-Annotations-1.0.10", d = c.resources.Rl(d));
        d || alert("License key not accepted. Please check your configuration settings.");
        jQuery(".flowpaper_tbloader").hide();
        d && jQuery(this).trigger("onPostinitialized");
    };
    this.Rl = function(c) {
        var d = this.aa,
            e = null != d.config.key && 0 < d.config.key.length && 0 <= d.config.key.indexOf("@"),
            g = parseInt(Math.pow(6, 2)) + W(!0) + "AdaptiveUId0ma1n";
        c = ba(parseInt(Math.pow(9, 3)) + (e ? d.config.key.split("$")[0] : W(!0)) + c);
        var f = ba(g),
            g = "$" + c.substring(11, 30).toLowerCase();
        c = "$" + f.substring(11, 30).toLowerCase();
        f = W(!1);
        return validated = (0 == f.indexOf("http://localhost/") || 0 == f.indexOf("http://localhost:") || 0 == f.indexOf("http://localhost:") || 0 == f.indexOf("http://192.168.") || 0 == f.indexOf("http://127.0.0.1") || 0 == f.indexOf("https://localhost/") || 0 == f.indexOf("https://localhost:") || 0 == f.indexOf("https://localhost:") || 0 == f.indexOf("https://192.168.") || 0 == f.indexOf("https://127.0.0.1") || 0 == f.indexOf("http://10.1.1.") || 0 == f.indexOf("http://git.devaldi.com") || 0 == f.indexOf("file://") ? !0 : 0 == f.indexOf("http://") ? !1 : 0 == f.indexOf("/") ? !0 : !1) || d.config.key == g || d.config.key == c || e && g == "$" + d.config.key.split("$")[1];
    };
    this.initialize = function() {
        var c = this.aa;
        c.ka.prepend(String.format("<div id='modal-I' class='modal-content'><p><a href='https://flowpaper.com/?ref=FlowPaper' target='_new'><img src='{0}' style='display:block;width:100px;heigh:auto;padding-bottom:10px;' border='0' /></a></p>FlowPaper  2.4.9. Developed by Devaldi Ltd.<br/>For more information, see the <a href='https://flowpaper.com/?ref=FlowPaper' target='_new'>FlowPaper Project</a> home page</div>", "data:image/png;base64,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"));
        c.about = function() {
            jQuery("#modal-I").smodal();
        };
    };
};

function W(f) {
    var c = window.location.href.toString();
    0 == c.length && (c = document.URL.toString());
    if (f) {
        var d;
        d = c.indexOf("///");
        0 <= d ? d = d + 3 : (d = c.indexOf("//"), d = 0 <= d ? d + 2 : 0);
        c = c.substr(d);
        d = c.indexOf(":");
        var e = c.indexOf("/");
        0 < d && 0 < e && d < e || (0 < e ? d = e : (e = c.indexOf("?"), d = 0 < e ? e : c.length));
        c = c.substr(0, d);
    }
    if (f && (f = c.split(".")) && (d = f.length, !(2 >= d))) {
        if (!(e = -1 != "co,com,net,org,web,gov,edu,".indexOf(f[d - 2] + ","))) {
            b: {
                for (var e = ".ac.uk .ab.ca .bc.ca .mb.ca .nb.ca .nf.ca .nl.ca .ns.ca .nt.ca .nu.ca .on.ca .pe.ca .qc.ca .sk.ca .yk.ca".split(" "), g = 0; g < e.length;) {
                    var h = e[g];
                    if (-1 !== c.indexOf(h, c.length - h.length)) {
                        e = !0;
                        break b;
                    }
                    g++;
                }
                e = !1;
            }
        }
        c = e ? f[d - 3] + "." + f[d - 2] + "." + f[d - 1] : f[d - 2] + "." + f[d - 1];
    }
    return c;
}
var ma = function() {
        function f() {}
        f.prototype = {
            Jd: function(c, d) {
                if (d.ib && (d.Ki || d.create(d.pages.da), !d.initialized)) {
                    c.qb = d.qb = c.config.MixedMode;
                    var e = d.ma;
                    0 == jQuery(e).length && (e = jQuery(d.Vc).find(d.ma));
                    if ("FlipView" == d.ba) {
                        var g = 0 != d.pageNumber % 2 ? "flowpaper_zine_page_left" : "flowpaper_zine_page_right";
                        0 == d.pageNumber && (g = "flowpaper_zine_page_left_noshadow");
                        d.aa.Uf || (g = 0 != d.pageNumber % 2 ? "flowpaper_zine_page_left_noshadow" : "flowpaper_zine_page_right_noshadow");
                        jQuery(e).append("<div id='" + d.pa + "_canvascontainer' style='height:100%;width:100%;position:relative;'><canvas id='" + c.Ja(1, d) + "' style='background-repeat:no-repeat;background-size:100% 100%;position:relative;left:0px;top:0px;height:100%;width:100%;background-color:#ffffff;display:none;' class='flowpaper_interactivearea flowpaper_grab flowpaper_hidden flowpaper_flipview_canvas flowpaper_flipview_page' width='100%' height='100%' ></canvas><canvas id='" + c.Ja(2, d) + "' style='position:relative;left:0px;top:0px;width:100%;height:100%;display:block;background-color:#ffffff;display:none;' class='flowpaper_border flowpaper_interactivearea flowpaper_grab flowpaper_rescale flowpaper_flipview_canvas_highres flowpaper_flipview_page' width='100%' height='100%'></canvas><div id='" + d.pa + "_textoverlay' style='position:absolute;z-index:11;left:0px;top:0px;width:100%;height:100%;' class='" + g + "'></div></div>");
                        if (eb.browser.chrome || eb.browser.safari) {
                            jQuery("#" + c.Ja(1, d)).css("-webkit-backface-visibility", "hidden"), jQuery("#" + c.Ja(2, d)).css("-webkit-backface-visibility", "hidden"), jQuery("#" + d.pa + "_textoverlay").css("-webkit-backface-visibility", "hidden");
                        }
                        eb.browser.mozilla && (jQuery("#" + c.Ja(1, d)).css("backface-visibility", "hidden"), jQuery("#" + c.Ja(2, d)).css("backface-visibility", "hidden"), jQuery("#" + d.pa + "_textoverlay").css("backface-visibility", "hidden"));
                    }
                    d.initialized = !0;
                }
            },
            Vo: function(c, d) {
                if ("FlipView" == d.ba && 0 == jQuery("#" + c.Ja(1, d)).length || "FlipView" == d.ba && d.Fa) {
                    return !1;
                }
                "FlipView" != d.ba || null != d.context || d.qc || d.Fa || (d.vd(), d.qc = !0);
                return !0;
            },
            Uo: function(c, d) {
                return 1 == d.scale || 1 < d.scale && d.pageNumber == d.pages.la - 1 || d.pageNumber == d.pages.la - 2;
            },
            Pb: function(c, d, e, g) {
                1 == d.scale && eb.browser.safari ? (jQuery("#" + c.Ja(1, d)).css("-webkit-backface-visibility", "hidden"), jQuery("#" + c.Ja(2, d)).css("-webkit-backface-visibility", "hidden"), jQuery("#" + d.pa + "_textoverlay").css("-webkit-backface-visibility", "hidden")) : eb.browser.safari && (jQuery("#" + c.Ja(1, d)).css("-webkit-backface-visibility", "visible"), jQuery("#" + c.Ja(2, d)).css("-webkit-backface-visibility", "visible"), jQuery("#" + d.pa + "_textoverlay").css("-webkit-backface-visibility", "visible"));
                if ("FlipView" != d.ba || 0 != jQuery("#" + c.Ja(1, d)).length) {
                    if ("FlipView" != d.ba || !d.Fa) {
                        if ("FlipView" == d.ba && 1 < d.scale) {
                            if (d.pageNumber == d.pages.la - 1 || d.pageNumber == d.pages.la - 2) {
                                jQuery(c).trigger("UIBlockingRenderingOperation", {
                                    ja: c.ja,
                                    po: !0
                                });
                                var f = 3 > d.scale ? 2236 : 3236;
                                magnifier = f * Math.sqrt(1 / (d.Va() * d.Za()));
                                d.ta.width = d.Va() * magnifier;
                                d.ta.height = d.Za() * magnifier;
                            } else {
                                c.li = !1, d.ta.width = 2 * d.Va(), d.ta.height = 2 * d.Za(), d.Fa = !0, jQuery("#" + d.Eb).mg(), c.Gk(d), eb.platform.touchdevice && (null != c.Yg && window.clearTimeout(c.Yg), c.Yg = setTimeout(function() {}, 1500)), null != g && g();
                            }
                        } else {
                            c.config.signature && d.qb && c.pageImagePattern && !d.Qf ? jQuery.ajax({
                                url: c.za(d.pageNumber + 1),
                                processData: !1
                            }).always(function(f) {
                                d.hd && jQuery.ajax({
                                    url: c.za(d.pageNumber + 2),
                                    processData: !1
                                }).always(function(c) {
                                    d.hd(f, c);
                                });
                                d.dimensions.loaded || c.Rc(d.pageNumber + 1, !0, function() {
                                    c.lc(d);
                                }, !0, d);
                                d.Gh = !0;
                                null == d.va ? (d.yb = !0, d.va = new Image, jQuery(d.va).bind("load", function() {
                                    jQuery(d.Ob).remove();
                                    jQuery(d.ta).css("background-image", "url('" + f + "')");
                                    d.yb = !1;
                                    c.cd();
                                }), jQuery(d.va).bind("error", function() {
                                    jQuery.ajax({
                                        url: this.src,
                                        type: "HEAD",
                                        error: function(f) {
                                            if (404 == f.status || 500 <= f.status) {
                                                d.Qf = !0, d.yb = !1, d.Gh = !0, d.Fa = !1, 1 == d.pageNumber && d.aa.pages.Kc && d.aa.pages.Kc(), c.Pb(d, e, g);
                                            }
                                        },
                                        success: function() {}
                                    });
                                }), jQuery(d.va).bind("error", function() {
                                    jQuery(d.Ob).remove();
                                    jQuery(d.ta).css("background-image", "url('" + f + "')");
                                    d.yb = !1;
                                    c.cd();
                                }), jQuery(d.va).attr("src", f), c.Yg = setTimeout(function() {
                                    d.yb && ("none" == jQuery(d.ta).css("background-image") && jQuery(d.ta).css("background-image", "url('" + f + "')"), d.yb = !1, c.cd());
                                }, 6000)) : d.yb || "none" == jQuery(d.ta).css("background-image") && jQuery(d.ta).css("background-image", "url('" + f + "')");
                                c.de(d, g);
                            }) : d.qb && c.pageImagePattern && !d.Qf ? (d.hd && d.hd(c.za(d.pageNumber + 1), c.za(d.pageNumber + 2)), d.dimensions.loaded || c.Rc(d.pageNumber + 1, !0, function() {
                                c.lc(d);
                            }, !0, d), d.Gh = !0, null == d.va ? (d.yb = !0, d.va = new Image, jQuery(d.va).bind("load", function() {
                                jQuery(d.Ob).remove();
                                jQuery(d.ta).css("background-image", "url('" + c.za(d.pageNumber + 1) + "')");
                                d.yb = !1;
                                c.cd();
                            }), jQuery(d.va).bind("error", function() {
                                jQuery.ajax({
                                    url: this.src,
                                    type: "HEAD",
                                    error: function(f) {
                                        if (404 == f.status || 500 <= f.status) {
                                            d.Qf = !0, d.yb = !1, d.Gh = !0, d.Fa = !1, 1 == d.pageNumber && d.aa.pages.Kc && d.aa.pages.Kc(), c.Pb(d, e, g);
                                        }
                                    },
                                    success: function() {}
                                });
                            }), jQuery(d.va).bind("error", function() {
                                jQuery(d.Ob).remove();
                                jQuery(d.ta).css("background-image", "url('" + c.za(d.pageNumber + 1) + "')");
                                d.yb = !1;
                                c.cd();
                            }), jQuery(d.va).attr("src", c.za(d.pageNumber + 1)), c.Yg = setTimeout(function() {
                                d.yb && ("none" == jQuery(d.ta).css("background-image") && jQuery(d.ta).css("background-image", "url('" + c.za(d.pageNumber + 1) + "')"), d.yb = !1, c.cd());
                            }, 6000)) : d.yb || "none" == jQuery(d.ta).css("background-image") && jQuery(d.ta).css("background-image", "url('" + c.za(d.pageNumber + 1) + "')"), c.de(d, g)) : !c.Ha && c.nb ? (magnifier = 1236 * Math.sqrt(1 / (d.Va() * d.Za())), d.ta.width = d.Va() * magnifier, d.ta.height = d.Za() * magnifier) : (d.ta.width = 1 * d.Va(), d.ta.height = 1 * d.Za());
                        }
                    }
                }
            },
            Jp: function(c, d) {
                return "FlipView" == d.ba;
            },
            pj: function(c, d) {
                "FlipView" == d.ba && (1 < d.scale ? (d.Eb = c.Ja(2, d), d.tf = c.Ja(1, d)) : (d.Eb = c.Ja(1, d), d.tf = c.Ja(2, d)));
            },
            de: function(c, d) {
                "FlipView" == d.ba && (1 < d.scale ? requestAnim(function() {
                    var e = jQuery("#" + c.Ja(2, d)).get(0);
                    e.redraw = d.ta.offsetHeight;
                    e.style.display = "";
                    jQuery("#" + c.Ja(1, d)).Vg();
                }) : (jQuery("#" + c.Ja(1, d)).mg(), jQuery("#" + c.Ja(2, d)).Vg()), d.qb && c.pageImagePattern && 1 == d.scale || jQuery(d.Ob).remove());
                jQuery(c).trigger("UIBlockingRenderingOperationCompleted", {
                    ja: c.ja
                });
                c.cd();
            }
        };
        CanvasPageRenderer.prototype.eh = function(c) {
            return "FlipView" == c.ba ? 1 : 1.4;
        };
        CanvasPageRenderer.prototype.Ke = function(c, d, e) {
            var g = this;
            if (null != g.pageThumbImagePattern && 0 < g.pageThumbImagePattern.length) {
                for (var f = 0, l = null, k = c.getDimensions(d)[d - 1].width / c.getDimensions(d)[d - 1].height, m = 1; m < d; m++) {
                    f += 2;
                }
                var n = 1 == d ? f + 1 : f,
                    u = jQuery.Deferred();
                g.config.signature ? jQuery.ajax({
                    url: g.za(n, 200),
                    processData: !1
                }).always(function(c) {
                    u.resolve(c);
                }) : u.resolve(g.za(n, 200));
                jQuery.when(u.promise()).then(function(l) {
                    var m = new Image;
                    jQuery(m).bind("load", function() {
                        var l = d % 10;
                        0 == l && (l = 10);
                        var p = c.ka.find(".flowpaper_fisheye").find(String.format('*[data-thumbIndex="{0}"]', l)).get(0);
                        p.width = e * k - 2;
                        p.height = e / k / 2 - 2;
                        var q = jQuery(p).parent().width() / p.width;
                        p.getContext("2d").fillStyle = "#999999";
                        var v = (p.height - p.height * k) / 2,
                            u = p.height * k;
                        0 > v && (p.height += p.width - u, v += (p.width - u) / 2);
                        eb.browser.msie && jQuery(p).css({
                            width: p.width * q + "px",
                            height: p.height * q + "px"
                        });
                        jQuery(p).data("origwidth", p.width * q);
                        jQuery(p).data("origheight", p.height * q);
                        p.getContext("2d").fillRect(1 == d ? p.width / 2 : 0, v, n == c.getTotalPages() ? p.width / 2 + 2 : p.width + 2, u + 2);
                        p.getContext("2d").drawImage(m, 1 == d ? p.width / 2 + 1 : 1, v + 1, p.width / 2, u);
                        if (1 < d && f + 1 <= c.getTotalPages() && n + 1 <= c.getTotalPages()) {
                            var z = new Image;
                            jQuery(z).bind("load", function() {
                                p.getContext("2d").drawImage(z, p.width / 2 + 1, v + 1, p.width / 2, u);
                                p.getContext("2d").strokeStyle = "#999999";
                                p.getContext("2d").moveTo(p.width - 1, v);
                                p.getContext("2d").lineTo(p.width - 1, u + 1);
                                p.getContext("2d").stroke();
                                jQuery(c).trigger("onThumbPanelThumbAdded", {
                                    Te: l,
                                    thumbData: p
                                });
                            });
                            var F = jQuery.Deferred();
                            g.config.signature ? jQuery.ajax({
                                url: g.za(n + 1, 200),
                                processData: !1
                            }).always(function(c) {
                                F.resolve(c);
                            }) : F.resolve(g.za(n + 1, 200));
                            jQuery.when(F.promise()).then(function(c) {
                                jQuery(z).attr("src", c);
                            });
                        } else {
                            jQuery(c).trigger("onThumbPanelThumbAdded", {
                                Te: l,
                                thumbData: p
                            });
                        }
                    });
                    jQuery(m).bind("error", function() {});
                    n <= c.getTotalPages() && jQuery(m).attr("src", l);
                }, function() {}, function() {});
            } else {
                if (-1 < g.Ma(null) || 1 != c.scale) {
                    window.clearTimeout(g.Ue), g.Ue = setTimeout(function() {
                        g.Ke(c, d, e);
                    }, 50);
                } else {
                    f = 0;
                    l = null;
                    k = c.getDimensions(d)[d - 1].width / c.getDimensions(d)[d - 1].height;
                    for (m = 1; m < d; m++) {
                        f += 2;
                    }
                    n = 1 == d ? f + 1 : f;
                    new Image;
                    var v = d % 10;
                    0 == v && (v = 10);
                    l = c.ka.find(".flowpaper_fisheye").find(String.format('*[data-thumbIndex="{0}"]', v)).get(0);
                    l.width = e * k;
                    l.height = e / k / 2;
                    m = jQuery(l).parent().width() / l.width;
                    eb.browser.msie && jQuery(l).css({
                        width: l.width * m + "px",
                        height: l.height * m + "px"
                    });
                    jQuery(l).data("origwidth", l.width * m);
                    jQuery(l).data("origheight", l.height * m);
                    var p = l.height / g.getDimensions()[n - 1].height;
                    g.Oa(null, "thumb_" + n);
                    g.Qa.getPage(n).then(function(m) {
                        var u = m.getViewport(p),
                            t = l.getContext("2d"),
                            y = document.createElement("canvas");
                        y.height = l.height;
                        y.width = y.height * k;
                        var E = {
                            canvasContext: y.getContext("2d"),
                            viewport: u,
                            uh: null,
                            pageNumber: n,
                            continueCallback: function(f) {
                                1 != c.scale ? (window.clearTimeout(g.Ue), g.Ue = setTimeout(function() {
                                    g.Ke(c, d, e);
                                }, 50)) : f();
                            }
                        };
                        m.render(E).promise.then(function() {
                            var m = (l.height - l.height * k) / 2,
                                q = l.height * k;
                            0 > m && (l.height += l.width - q, m += (l.width - q) / 2);
                            g.Oa(null, -1, "thumb_" + n);
                            1 < d && f + 1 <= c.getTotalPages() && n + 1 <= c.getTotalPages() ? -1 < g.Ma(null) || 1 != c.scale ? (window.clearTimeout(g.Ue), g.Ue = setTimeout(function() {
                                g.Ke(c, d, e);
                            }, 50)) : (g.Oa(null, "thumb_" + (n + 1)), g.Qa.getPage(n + 1).then(function(f) {
                                u = f.getViewport(p);
                                var h = document.createElement("canvas");
                                h.width = y.width;
                                h.height = y.height;
                                E = {
                                    canvasContext: h.getContext("2d"),
                                    viewport: u,
                                    uh: null,
                                    pageNumber: n + 1,
                                    continueCallback: function(f) {
                                        1 != c.scale ? (window.clearTimeout(g.Ue), g.Ue = setTimeout(function() {
                                            g.Ke(c, d, e);
                                        }, 50)) : f();
                                    }
                                };
                                f.render(E).promise.then(function() {
                                    g.Oa(null, -1);
                                    t.fillStyle = "#ffffff";
                                    t.fillRect(1 == d ? l.width / 2 : 0, m, l.width / 2, q);
                                    1 != d && t.fillRect(l.width / 2, m, l.width / 2, q);
                                    t.drawImage(y, 1 == d ? l.width / 2 : 0, m, l.width / 2, q);
                                    1 != d && t.drawImage(h, l.width / 2, m, l.width / 2, q);
                                    jQuery(c).trigger("onThumbPanelThumbAdded", {
                                        Te: v,
                                        thumbData: l
                                    });
                                }, function() {
                                    g.Oa(null, -1, "thumb_" + (n + 1));
                                });
                            })) : (t.fillStyle = "#ffffff", t.fillRect(1 == d ? l.width / 2 : 0, m, l.width / 2, q), 1 != d && t.fillRect(l.width / 2, m, l.width / 2, q), t.drawImage(y, 1 == d ? l.width / 2 : 0, m, l.width / 2, q), jQuery(c).trigger("onThumbPanelThumbAdded", {
                                Te: v,
                                thumbData: l
                            }));
                        }, function() {
                            g.Oa(null, -1);
                        });
                    });
                }
            }
        };
        return f;
    }(),
    la = function() {
        function f() {}
        f.prototype = {
            Jd: function(c, d) {
                if (d.ib && (d.Ki || d.create(d.pages.da), !d.initialized)) {
                    c.tb = null != c.Zi && 0 < c.Zi.length && eb.platform.touchonlydevice && !eb.platform.mobilepreview;
                    if ("FlipView" == d.ba) {
                        var e = 0 != d.pageNumber % 2 ? "flowpaper_zine_page_left" : "flowpaper_zine_page_right";
                        0 == d.pageNumber && (e = "flowpaper_zine_page_left_noshadow");
                        d.aa.Uf || (e = 0 != d.pageNumber % 2 ? "flowpaper_zine_page_left_noshadow" : "flowpaper_zine_page_right_noshadow");
                        var g = d.ma;
                        0 == jQuery(g).length && (g = jQuery(d.Vc).find(d.ma));
                        c.Zg(d, g);
                        c.Jb ? jQuery(g).append("<canvas id='" + d.pa + "_canvas' class='flowpaper_flipview_page' height='100%' width='100%' style='z-index:10;position:absolute;left:0px;top:0px;width:100%;height:100%;'></canvas><canvas id='" + d.pa + "_canvas_highres' class='flowpaper_flipview_page' height='100%' width='100%' style='display:none;z-index:10;position:absolute;left:0px;top:0px;width:100%;height:100%;background-color:#ffffff;'></canvas><div id='" + d.pa + "_textoverlay' style='z-index:11;position:absolute;left:0px;top:0px;width:100%;height:100%;' class='" + e + "'></div>") : jQuery(g).append("<canvas id='" + d.pa + "_canvas' class='flowpaper_flipview_page' height='100%' width='100%' style='z-index:10;position:absolute;left:0px;top:0px;width:100%;height:100%;'></canvas><canvas id='" + d.pa + "_canvas_highres' class='flowpaper_flipview_page' height='100%' width='100%' style='image-rendering:-webkit-optimize-contrast;display:none;z-index:10;position:absolute;left:0px;top:0px;width:100%;height:100%;'></canvas><div id='" + d.pa + "_textoverlay' style='z-index:11;position:absolute;left:0px;top:0px;width:100%;height:100%;' class='" + e + "'></div>");
                        if (eb.browser.chrome || eb.browser.safari) {
                            eb.browser.safari && (jQuery("#" + d.pa + "_canvas").css("-webkit-backface-visibility", "hidden"), jQuery("#" + d.pa + "_canvas_highres").css("-webkit-backface-visibility", "hidden")), jQuery("#" + d.pa + "_textoverlay").css("-webkit-backface-visibility", "hidden");
                        }
                    }
                    d.initialized = !0;
                }
            },
            Pb: function(c, d, e, g) {
                d.initialized || c.Jd(d);
                if (!d.Fa && "FlipView" == d.ba) {
                    if (-1 < c.Ma(d) && d.pageNumber != d.pages.la && d.pageNumber != d.pages.la - 2 && d.pageNumber != d.pages.la - 1) {
                        if (window.clearTimeout(d.gc), d.pageNumber == d.pages.la || d.pageNumber == d.pages.la - 2 || d.pageNumber == d.pages.la - 1) {
                            d.gc = setTimeout(function() {
                                c.Pb(d, e, g);
                            }, 250);
                        }
                    } else {
                        1 == d.scale && d.hd && d.hd(c.za(d.pageNumber + 1), c.za(d.pageNumber + 2));
                        if (!d.Fa) {
                            c.Fq = d.scale;
                            c.Oa(d, d.pageNumber);
                            1 == d.scale && d.vd();
                            d.yb = !0;
                            if (!d.va || d.Rn != d.scale || c.Pl(d)) {
                                d.Rn = d.scale, d.va = new Image, jQuery(d.va).bind("load", function() {
                                    d.yb = !1;
                                    d.nf = !0;
                                    d.bg = this.height;
                                    d.cg = this.width;
                                    d.oc();
                                    c.Dc(d);
                                    d.dimensions.Ca > d.dimensions.width && (d.dimensions.width = d.dimensions.Ca, d.dimensions.height = d.dimensions.Na);
                                }), jQuery(d.va).bind("abort", function() {
                                    d.yb = !1;
                                    c.Oa(d, -1);
                                }), jQuery(d.va).bind("error", function() {
                                    d.yb = !1;
                                    c.Oa(d, -1);
                                });
                            }
                            1 >= d.scale ? jQuery(d.va).attr("src", c.za(d.pageNumber + 1, null, c.Jb)) : c.tb && 1 < d.scale ? d.pageNumber == d.pages.la - 1 || d.pageNumber == d.pages.la - 2 ? jQuery(d.va).attr("src", c.za(d.pageNumber + 1, null, c.Jb)) : jQuery(d.va).attr("src", c.wa) : d.pageNumber == d.pages.la - 1 || d.pageNumber == d.pages.la - 2 ? (!c.Jb || -1 != jQuery(d.va).attr("src").indexOf(".svg") && d.Zn == d.scale || c.Ma(d) != d.pageNumber || d.pageNumber != d.pages.la - 1 && d.pageNumber != d.pages.la - 2 ? d.Il == d.scale && (jQuery(d.ma + "_canvas_highres").show(), jQuery(d.ma + "_canvas").hide()) : (jQuery(c).trigger("UIBlockingRenderingOperation", c.ja), d.Zn = d.scale, jQuery(d.va).attr("src", c.za(d.pageNumber + 1, null, c.Jb))), c.Jb || jQuery(d.va).attr("src", c.za(d.pageNumber + 1, null, c.Jb))) : jQuery(d.va).attr("src", c.wa);
                        }
                        jQuery(d.ma).removeClass("flowpaper_load_on_demand");
                        !d.Fa && jQuery(d.Ka).attr("src") == c.wa && d.nf && c.Dc(d);
                        null != g && g();
                    }
                }
            },
            Dc: function(c, d) {
                if ("FlipView" == d.ba) {
                    jQuery(d.ma).removeClass("flowpaper_hidden");
                    jQuery(".flowpaper_pageLoader").hide();
                    1 == d.scale && eb.browser.safari ? (jQuery("#" + d.pa + "_canvas").css("-webkit-backface-visibility", "hidden"), jQuery("#" + d.pa + "_canvas_highres").css("-webkit-backface-visibility", "hidden"), jQuery("#" + d.pa + "_textoverlay").css("-webkit-backface-visibility", "hidden")) : eb.browser.safari && (jQuery("#" + d.pa + "_canvas").css("-webkit-backface-visibility", "visible"), jQuery("#" + d.pa + "_canvas_highres").css("-webkit-backface-visibility", "visible"), jQuery("#" + d.pa + "_textoverlay").css("-webkit-backface-visibility", "visible"));
                    if (c.Pl(d)) {
                        1 == d.scale ? (jQuery(d.Ia).css("background-image", "url('" + c.za(d.pageNumber + 1, null, c.Jb) + "')"), jQuery("#" + d.pa + "_textoverlay").css("-webkit-backface-visibility", "visible"), jQuery("#" + d.pa + "_textoverlay").css("backface-visibility", "visible"), c.zc(d)) : (d.pageNumber == d.pages.la - 1 || d.pageNumber == d.pages.la - 2 ? jQuery(d.Ia).css("background-image", "url('" + c.za(d.pageNumber + 1) + "')") : jQuery(d.Ia).css("background-image", "url(" + c.wa + ")"), jQuery("#" + d.pa + "_textoverlay").css("-webkit-backface-visibility", "visible"), jQuery("#" + d.pa + "_textoverlay").css("backface-visibility", "visible"), jQuery(d.ma + "_canvas").hide(), c.tb && d.scale > d.Xf() && (d.gc = setTimeout(function() {
                            c.Xc(d);
                            jQuery(".flowpaper_flipview_canvas_highres").show();
                            jQuery(".flowpaper_flipview_canvas").hide();
                        }, 500)));
                    } else {
                        var e = document.getElementById(d.pa + "_canvas");
                        jQuery(d.Ia).css("background-image", "url(" + c.wa + ")");
                        if (1 == d.scale && e && (100 == e.width || jQuery(e).hasClass("flowpaper_redraw"))) {
                            var g = e;
                            if (g) {
                                g.width = d.Va();
                                g.height = d.Za();
                                var f = g.getContext("2d");
                                f.Hf = f.mozImageSmoothingEnabled = f.imageSmoothingEnabled = !0;
                                f.drawImage(d.va, 0, 0, d.Va(), d.Za());
                                jQuery(e).removeClass("flowpaper_redraw");
                                1 == d.scale && (jQuery(d.ma + "_canvas").show(), jQuery(d.ma + "_canvas_highres").hide());
                                1 < d.pageNumber && jQuery(d.ma + "_pixel").css({
                                    width: 2 * d.Va(),
                                    height: 2 * d.Za()
                                });
                                c.zc(d);
                            }
                        } else {
                            1 == d.scale && e && 100 != e.width && (jQuery(d.ma + "_canvas").show(), jQuery(d.ma + "_canvas_highres").hide(), c.zc(d));
                        }
                        if (1 < d.scale) {
                            if (g = document.getElementById(d.pa + "_canvas_highres")) {
                                !(c.Jb && d.Il != d.scale || 100 == g.width || jQuery(g).hasClass("flowpaper_redraw")) || d.pageNumber != d.pages.la - 1 && d.pageNumber != d.pages.la - 2 ? (jQuery(d.ma + "_pixel").css({
                                    width: 2 * d.Va(),
                                    height: 2 * d.Za()
                                }), jQuery(d.ma + "_canvas_highres").show(), jQuery(d.ma + "_canvas").hide(), c.tb && jQuery(d.ma + "_canvas_highres").css("z-index", "-1")) : (d.Il = d.scale, jQuery(c).trigger("UIBlockingRenderingOperation", c.ja), e = 1000 < d.ia.width() || 1000 < d.ia.height() ? 1 : 2, f = (d.ia.width() - 30) * d.scale, eb.platform.ios && (1500 < f * d.jf() || 535 < d.hf()) && (e = 2236 * Math.sqrt(1 / (d.Va() * d.Za()))), eb.browser.safari && !eb.platform.touchdevice && 3 > e && (e = 3), f = g.getContext("2d"), f.Hf || f.mozImageSmoothingEnabled || f.imageSmoothingEnabled ? (f.Hf = f.mozImageSmoothingEnabled = f.imageSmoothingEnabled = !1, c.Jb ? (g.width = d.Va() * e, g.height = d.Za() * e, f.drawImage(d.va, 0, 0, d.Va() * e, d.Za() * e)) : (g.width = d.va.width, g.height = d.va.height, f.drawImage(d.va, 0, 0))) : (g.width = d.Va() * e, g.height = d.Za() * e, f.drawImage(d.va, 0, 0, d.Va() * e, d.Za() * e)), c.Jb ? c.Wn(d, g.width / d.va.width, function() {
                                    jQuery(g).removeClass("flowpaper_redraw");
                                    jQuery(d.ma + "_canvas_highres").show();
                                    jQuery(d.ma + "_canvas").hide();
                                    jQuery(d.ma + "_canvas_highres").addClass("flowpaper_flipview_canvas_highres");
                                    jQuery(d.ma + "_canvas").addClass("flowpaper_flipview_canvas");
                                    c.Oa(d, -1);
                                }) : (jQuery(g).removeClass("flowpaper_redraw"), jQuery(d.ma + "_canvas_highres").show(), jQuery(d.ma + "_canvas").hide(), jQuery(d.ma + "_canvas_highres").addClass("flowpaper_flipview_canvas_highres"), jQuery(d.ma + "_canvas").addClass("flowpaper_flipview_canvas"), c.tb && jQuery(d.ma + "_canvas_highres").css("z-index", "-1")));
                            }
                            d.gc = setTimeout(function() {
                                c.Xc(d);
                            }, 500);
                        }
                    }
                    d.Fa = 0 < jQuery(d.Ia).length;
                }
            },
            unload: function(c, d) {
                d.va = null;
                jQuery(d.Ia).css("background-image", "url(" + c.wa + ")");
                var e = document.getElementById(d.pa + "_canvas");
                e && (e.width = 100, e.height = 100);
                if (e = document.getElementById(d.pa + "_canvas_highres")) {
                    e.width = 100, e.height = 100;
                }
            }
        };
        ImagePageRenderer.prototype.Pl = function(c) {
            return eb.platform.touchdevice && (eb.platform.Kd || 5000000 < c.cg * c.bg || eb.platform.android) && (eb.platform.Kd || eb.platform.android) || eb.browser.chrome || eb.browser.mozilla;
        };
        ImagePageRenderer.prototype.resize = function(c, d) {
            this.Zg(d);
        };
        ImagePageRenderer.prototype.Wn = function(c, d, e) {
            var g = this;
            window.di = d;
            jQuery.ajax({
                type: "GET",
                url: g.za(c.pageNumber + 1, null, g.Jb),
                cache: !0,
                dataType: "xml",
                success: function(f) {
                    var l = new Image;
                    jQuery(l).bind("load", function() {
                        var g = document.getElementById(c.pa + "_canvas"),
                            m = document.getElementById(c.pa + "_canvas_highres").getContext("2d");
                        m.Hf = m.mozImageSmoothingEnabled = m.imageSmoothingEnabled = !1;
                        var n = g.getContext("2d");
                        n.Hf = n.mozImageSmoothingEnabled = n.imageSmoothingEnabled = !1;
                        g.width = c.va.width * d;
                        g.height = c.va.height * d;
                        n.drawImage(l, 0, 0, c.va.width * d, c.va.height * d);
                        if (c.Hl) {
                            u = c.Hl;
                        } else {
                            var u = [];
                            jQuery(f).find("image").each(function() {
                                var c = {};
                                c.id = jQuery(this).attr("id");
                                c.width = R(jQuery(this).attr("width"));
                                c.height = R(jQuery(this).attr("height"));
                                c.data = jQuery(this).attr("xlink:href");
                                c.dataType = 0 < c.data.length ? c.data.substr(0, 15) : "";
                                u[u.length] = c;
                                jQuery(f).find("use[xlink\\:href='#" + c.id + "']").each(function() {
                                    if (jQuery(this).attr("transform") && (c.transform = jQuery(this).attr("transform"), c.transform = c.transform.substr(7, c.transform.length - 8), c.xh = c.transform.split(" "), c.x = R(c.xh[c.xh.length - 2]), c.y = R(c.xh[c.xh.length - 1]), "g" == jQuery(this).parent()[0].nodeName && null != jQuery(this).parent().attr("clip-path"))) {
                                        var d = jQuery(this).parent().attr("clip-path"),
                                            d = d.substr(5, d.length - 6);
                                        jQuery(f).find("*[id='" + d + "']").each(function() {
                                            c.Pf = [];
                                            jQuery(this).find("path").each(function() {
                                                var d = {};
                                                d.d = jQuery(this).attr("d");
                                                c.Pf[c.Pf.length] = d;
                                            });
                                        });
                                    }
                                });
                            });
                            c.Hl = u;
                        }
                        for (n = 0; n < u.length; n++) {
                            if (u[n].Pf) {
                                for (var v = 0; v < u[n].Pf.length; v++) {
                                    for (var p = u[n].Pf[v].d.replace(/M/g, "M\x00").replace(/m/g, "m\x00").replace(/v/g, "v\x00").replace(/l/g, "l\x00").replace(/h/g, "h\x00").replace(/c/g, "c\x00").replace(/s/g, "s\x00").replace(/z/g, "z\x00").split(/(?=M|m|v|h|s|c|l|z)|\0/), q = 0, r = 0, t = 0, y = 0, E = !1, x, A = !0, z = 0; z < p.length; z += 2) {
                                        if ("M" == p[z] && p.length > z + 1 && (x = S(p[z + 1]), t = q = R(x[0]), y = r = R(x[1]), A && (E = !0)), "m" == p[z] && p.length > z + 1 && (x = S(p[z + 1]), t = q += R(x[0]), y = r += R(x[1]), A && (E = !0)), "l" == p[z] && p.length > z + 1 && (x = S(p[z + 1]), q += R(x[0]), r += R(x[1])), "h" == p[z] && p.length > z + 1 && (x = S(p[z + 1]), q += R(x[0])), "v" == p[z] && p.length > z + 1 && (x = S(p[z + 1]), r += R(x[0])), "s" == p[z] && p.length > z + 1 && (x = S(p[z + 1])), "c" == p[z] && p.length > z + 1 && (x = S(p[z + 1])), "z" == p[z] && p.length > z + 1 && (q = t, r = y, x = null), E && (m.save(), m.beginPath(), A = E = !1), "M" == p[z] || "m" == p[z]) {
                                            m.moveTo(q, r);
                                        } else {
                                            if ("c" == p[z] && null != x) {
                                                for (var F = 0; F < x.length; F += 6) {
                                                    var I = q + R(x[F + 0]),
                                                        J = r + R(x[F + 1]),
                                                        H = q + R(x[F + 2]),
                                                        w = r + R(x[F + 3]),
                                                        G = q + R(x[F + 4]),
                                                        B = r + R(x[F + 5]);
                                                    m.bezierCurveTo(I, J, H, w, G, B);
                                                    q = G;
                                                    r = B;
                                                }
                                            } else {
                                                "s" == p[z] && null != x ? (H = q + R(x[0]), w = r + R(x[1]), G = q + R(x[2]), B = r + R(x[3]), m.bezierCurveTo(q, r, H, w, G, B), q = G, r = B) : "z" == p[z] ? (m.lineTo(q, r), m.closePath(), m.clip(), m.drawImage(g, 0, 0), m.restore(), A = !0, z--) : m.lineTo(q, r);
                                            }
                                        }
                                    }
                                }
                            } else {
                                K("no clip path for image!");
                            }
                        }
                        e && e();
                    });
                    l.src = g.za(c.pageNumber + 1);
                }
            });
        };
        ImagePageRenderer.prototype.Ke = function(c, d, e) {
            var g = this,
                f = 0,
                l = c.getDimensions(d)[d - 1].Ca / c.getDimensions(d)[d - 1].Na;
            g.nb && 1 < d && (l = c.getDimensions(1)[0].Ca / c.getDimensions(1)[0].Na);
            for (var k = 1; k < d; k++) {
                f += 2;
            }
            var m = 1 == d ? f + 1 : f,
                n = new Image;
            jQuery(n).bind("load", function() {
                var k = d % 10;
                0 == k && (k = 10);
                var v = jQuery(".flowpaper_fisheye").find(String.format('*[data-thumbIndex="{0}"]', k)).get(0);
                v.width = e * l - 2;
                v.height = e / l / 2 - 2;
                var p = jQuery(v).parent().width() / v.width;
                v.getContext("2d").fillStyle = "#999999";
                var q = (v.height - v.height * l) / 2,
                    r = v.height * l;
                0 > q && (v.height += v.width - r, q += (v.width - r) / 2);
                jQuery(v).data("origwidth", v.width * p);
                jQuery(v).data("origheight", v.height * p);
                (eb.browser.msie || eb.browser.safari && 5 > eb.browser.Hb) && jQuery(v).css({
                    width: v.width * p + "px",
                    height: v.height * p + "px"
                });
                v.getContext("2d").fillRect(1 == d ? v.width / 2 : 0, q, m == c.getTotalPages() ? v.width / 2 + 2 : v.width + 2, r + 2);
                v.getContext("2d").drawImage(n, 1 == d ? v.width / 2 + 1 : 1, q + 1, v.width / 2, r);
                if (1 < d && f + 1 <= c.getTotalPages() && m + 1 <= c.getTotalPages()) {
                    var t = new Image;
                    jQuery(t).bind("load", function() {
                        v.getContext("2d").drawImage(t, v.width / 2 + 1, q + 1, v.width / 2, r);
                        v.getContext("2d").strokeStyle = "#999999";
                        v.getContext("2d").moveTo(v.width - 1, q);
                        v.getContext("2d").lineTo(v.width - 1, r + 1);
                        v.getContext("2d").stroke();
                        jQuery(c).trigger("onThumbPanelThumbAdded", {
                            Te: k,
                            thumbData: v
                        });
                    });
                    jQuery(t).attr("src", g.za(m + 1, 200));
                } else {
                    jQuery(c).trigger("onThumbPanelThumbAdded", {
                        Te: k,
                        thumbData: v
                    });
                }
            });
            m <= c.getTotalPages() && jQuery(n).attr("src", g.za(m, 200));
        };
        return f;
    }(),
    ja = function() {
        function f() {}
        V.prototype.Qg = function() {
            var c = this.aa.ca.ig,
                d = this.Rg(0),
                d = d.Ca / d.Na,
                e = Math.round(this.ia.height() - 10);
            this.aa.ka.find(".flowpaper_fisheye");
            var g = eb.platform.touchdevice ? 90 == window.orientation || -90 == window.orientation || jQuery(window).height() > jQuery(window).width() : !1;
            this.aa.ca.Sf && !this.aa.PreviewMode ? e -= eb.platform.touchonlydevice ? this.aa.ac ? this.aa.ca.Xb.height() : 0 : this.ia.height() * (this.aa.ac ? 0.2 : 0.15) : this.aa.PreviewMode ? this.aa.PreviewMode && (e = this.aa.ka.height() - 15, e -= eb.platform.touchonlydevice ? this.aa.ac ? this.aa.ca.Xb.height() + 30 : 0 : this.ia.height() * (g ? 0.5 : 0.09)) : e = this.aa.$d ? e - (eb.platform.touchonlydevice ? this.aa.ac ? 5 : 0 : this.ia.height() * (g ? 0.5 : 0.07)) : e - (eb.platform.touchonlydevice ? this.aa.ac ? this.aa.ca.Xb.height() : 0 : this.ia.height() * (g ? 0.5 : 0.07));
            g = this.ia.width();
            2 * e * d > g - (c ? 53 : 0) && !this.aa.ca.Ta && (e = g / 2 / d - +(c ? 35 : 75));
            if (e * d > g - (c ? 53 : 0) && this.aa.ca.Ta) {
                for (var f = 10; e * d > g - (c ? 53 : 0) && 1000 > f;) {
                    e = g / d - f + (c ? 0 : 50), f += 10;
                }
            }
            if (!eb.browser.Qq) {
                for (c = 2.5 * Math.floor(e * (this.aa.ca.Ta ? 1 : 2) * d), g = 0; 0 != c % 4 && 20 > g;) {
                    e += 0.5, c = 2.5 * Math.floor(e * (this.aa.ca.Ta ? 1 : 2) * d), g++;
                }
            }
            return e;
        };
        V.prototype.En = function(c, d) {
            var e = this;
            c = parseInt(c);
            e.aa.Sd = d;
            e.aa.renderer.ce && e.Ne(c);
            1 != this.aa.scale ? e.Xa(1, !0, function() {
                e.aa.turn("page", c);
            }) : e.aa.turn("page", c);
        };
        V.prototype.wi = function() {
            return (this.ia.width() - this.ed()) / 2;
        };
        V.prototype.ed = function() {
            var c = this.Rg(0),
                c = c.Ca / c.Na;
            return Math.floor(this.Qg() * (this.aa.ca.Ta ? 1 : 2) * c);
        };
        V.prototype.ge = function() {
            if ("FlipView" == this.aa.ba) {
                return 0 < this.width ? this.width : this.width = this.ga(this.da).width();
            }
        };
        V.prototype.hf = function() {
            if ("FlipView" == this.aa.ba) {
                return 0 < this.height ? this.height : this.height = this.ga(this.da).height();
            }
        };
        f.prototype = {
            Ne: function(c, d) {
                for (var e = d - 10; e < d + 10; e++) {
                    0 < e && e + 1 < c.aa.getTotalPages() + 1 && !c.getPage(e).initialized && (c.getPage(e).ib = !0, c.aa.renderer.Jd(c.getPage(e)), c.getPage(e).ib = !1);
                }
            },
            fc: function(c) {
                null != c.Qd && (window.clearTimeout(c.Qd), c.Qd = null);
                var d = 1 < c.la ? c.la - 1 : c.la;
                if (!c.aa.renderer.vb || c.aa.renderer.qb && 1 == c.aa.scale) {
                    1 <= c.la ? (c.pages[d - 1].load(function() {
                        1 < c.la && c.pages[d] && c.pages[d].load(function() {
                            c.pages[d].La();
                            for (var e = c.ga(c.da).scrollTop(), g = 0; g < c.document.numPages; g++) {
                                c.kb(g) && (c.pages[g].Nc(e, c.ga(c.da).height(), !0) ? (c.pages[g].ib = !0, c.pages[g].load(function() {}), c.pages[g].La()) : c.pages[g].unload());
                            }
                        });
                    }), c.pages[d - 1].La()) : c.pages[d] && c.pages[d].load(function() {
                        c.pages[d].La();
                        for (var e = c.ga(c.da).scrollTop(), g = 0; g < c.document.numPages; g++) {
                            c.kb(g) && (c.pages[g].Nc(e, c.ga(c.da).height(), !0) ? (c.pages[g].ib = !0, c.pages[g].load(function() {}), c.pages[g].La()) : c.pages[g].unload());
                        }
                    });
                } else {
                    1 < c.la ? (c.pages[d - 1] && c.pages[d - 1].load(function() {}), c.pages[d - 0] && c.pages[d - 0].load(function() {})) : c.pages[d] && c.pages[d].load(function() {});
                    for (var e = c.ga(c.da).scrollTop(), g = 0; g < c.document.numPages; g++) {
                        c.kb(g) && (c.pages[g].Nc(e, c.ga(c.da).height(), !0) ? (c.pages[g].ib = !0, c.pages[g].load(function() {}), c.pages[g].La()) : c.pages[g].unload());
                    }
                }
            },
            Wi: function(c) {
                c.ki = setTimeout(function() {
                    c.aa.pages && "FlipView" == c.aa.ba && (1.1 < c.aa.scale ? (c.ga(c.da + "_panelLeft").finish(), c.ga(c.da + "_panelRight").finish(), c.ga(c.da + "_panelLeft").fadeTo("fast", 0), c.ga(c.da + "_panelRight").fadeTo("fast", 0), c.aa.Ea.data().opts.cornerDragging = !1) : (c.ga(c.da + "_panelLeft").finish(), c.ga(c.da + "_panelRight").finish(), 1 < c.la ? c.ga(c.da + "_panelLeft").fadeTo("fast", 1) : c.ga(c.da + "_panelLeft").fadeTo("fast", 0), c.aa.ua < c.aa.getTotalPages() && c.ga(c.da + "_panelRight").fadeTo("fast", 1), c.aa.Ea && c.aa.Ea.data().opts && (c.aa.Ea.data().opts.cornerDragging = !0)), c.ih = !1);
                }, 1000);
            },
            ic: function(c) {
                return "FlipView" == c.aa.ba && !(eb.browser.safari && 7 <= eb.browser.Hb && !eb.platform.touchdevice);
            },
            Xa: function(c, d, e, g, f) {
                jQuery(c).trigger("onScaleChanged");
                1 < e && 0 < jQuery("#" + c.Rb).length && jQuery("#" + c.Rb).css("z-index", -1);
                if ("FlipView" == c.aa.ba && (e >= 1 + c.aa.document.ZoomInterval ? jQuery(".flowpaper_page, " + c.da).removeClass("flowpaper_page_zoomIn").addClass("flowpaper_page_zoomOut") : jQuery(".flowpaper_page, " + c.da).removeClass("flowpaper_page_zoomOut").addClass("flowpaper_page_zoomIn"), jQuery(c.da).data().totalPages)) {
                    var l = c.Rg(0),
                        k = l.Ca / l.Na,
                        l = c.Qg() * e,
                        k = 2 * l * k;
                    if (!g || !c.ic() || 1 < d && !c.ga(c.da + "_parent").mf()) {
                        if (c.ga(c.da + "_parent").mf() && e >= 1 + c.aa.document.ZoomInterval && ((d = c.Ai()) ? (c.ga(c.da + "_parent").transition({
                                transformOrigin: "0px 0px"
                            }, 0), c.ga(c.da + "_parent").transition({
                                x: 0,
                                y: 0,
                                scale: 1
                            }, 0), g.jc = d.left, g.Ic = d.top, g.Ed = !0) : (m = 1 != c.aa.ua || c.aa.ca.Ta ? 0 : -(c.ed() / 4), c.ga(c.da + "_parent").transition({
                                x: m,
                                y: c.aa.hc,
                                scale: 1
                            }, 0))), c.ga(c.da).mf() && c.ga(c.da).transition({
                                x: 0,
                                y: 0,
                                scale: 1
                            }, 0), !c.animating) {
                            c.lh || (c.lh = c.aa.Ea.width(), c.ro = c.aa.Ea.height());
                            1 == e && c.lh ? (turnwidth = c.lh, turnheight = c.ro) : (turnwidth = k - (c.ga(c.da + "_panelLeft").width() + c.ga(c.da + "_panelRight").width() + 40), turnheight = l);
                            c.ga(c.da).css({
                                width: k,
                                height: l
                            });
                            c.aa.Ea.turn("size", turnwidth, turnheight, !1);
                            e >= 1 + c.aa.document.ZoomInterval ? (g.Ed || eb.platform.touchonlydevice) && requestAnim(function() {
                                c.ia.scrollTo({
                                    left: jQuery(c.ia).scrollLeft() + g.jc / e + "px",
                                    top: jQuery(c.ia).scrollTop() + g.Ic / e + "px"
                                });
                            }, 500) : c.Ee();
                            for (l = 0; l < c.document.numPages; l++) {
                                c.kb(l) && (c.pages[l].Fa = !1);
                            }
                            1 < e ? c.aa.Ea.turn("setCornerDragging", !1) : (c.ga(c.da + "_panelLeft").show(), c.ga(c.da + "_panelRight").show(), c.aa.Ea.turn("setCornerDragging", !0));
                            c.sd();
                            setTimeout(function() {
                                null != f && f();
                            }, 200);
                        }
                    } else {
                        if (!c.animating || !c.Wj) {
                            c.animating = !0;
                            c.Wj = g.Ed;
                            jQuery(".flowpaper_flipview_canvas").show();
                            jQuery(".flowpaper_flipview_canvas_highres").hide();
                            jQuery("#" + c.Rb).css("z-index", -1);
                            jQuery(c).trigger("onScaleChanged");
                            l = 400;
                            d = "snap";
                            c.aa.document.ZoomTime && (l = 1000 * parseFloat(c.aa.document.ZoomTime));
                            c.aa.document.ZoomTransition && ("easeOut" == c.aa.document.ZoomTransition && (d = "snap"), "easeIn" == c.aa.document.ZoomTransition && (d = "ease-in", l /= 2));
                            g && g.jc && g.Ic ? (g.Ed && (g.jc = g.jc + c.wi()), g.Ed || eb.platform.touchonlydevice ? (c.Bd = g.jc, c.Cd = g.Ic) : (k = c.ga(c.da + "_parent").css("transformOrigin").split(" "), 2 == k.length ? (k[0] = k[0].replace("px", ""), k[1] = k[1].replace("px", ""), c.Bd = parseFloat(k[0]), c.Cd = parseFloat(k[1])) : (c.Bd = g.jc, c.Cd = g.Ic), c.ql = !0), g.Jf && (l = g.Jf)) : (c.Bd = 0, c.Cd = 0);
                            c.aa.renderer.vb && c.aa.renderer.tb && 1 == e && (k = 1 < c.la ? c.la - 1 : c.la, 1 < c.la && c.aa.renderer.zc(c.pages[k - 1]), c.aa.renderer.zc(c.pages[k]));
                            "undefined" != g.Jf && (l = g.Jf);
                            e >= 1 + c.aa.document.ZoomInterval ? ("preserve-3d" == c.ga(c.da + "_parent").css("transform-style") && (l = 0), (g.Ed || eb.platform.touchonlydevice) && c.ga(c.da + "_parent").css({
                                transformOrigin: c.Bd + "px " + c.Cd + "px"
                            }), c.aa.Ea.turn("setCornerDragging", !1)) : (c.ga(c.da).transition({
                                x: 0,
                                y: 0
                            }, 0), c.aa.Ea.turn("setCornerDragging", !0));
                            var m = 1 != c.aa.ua || c.aa.ca.Ta ? 0 : -(c.ed() / 4);
                            c.ga(c.da + "_parent").transition({
                                x: m,
                                y: c.aa.hc,
                                scale: e
                            }, l, d, function() {
                                null != c.te && (window.clearTimeout(c.te), c.te = null);
                                c.te = setTimeout(function() {
                                    for (var d = 0; d < c.document.numPages; d++) {
                                        c.pages[d].Fa = !1;
                                    }
                                    c.pd = 0;
                                    c.me = 0;
                                    c.sd();
                                    c.animating = !1;
                                    c.Wj = !1;
                                }, 50);
                                1 == e && c.ga(c.da + "_parent").css("-webkit-transform-origin:", "");
                                null != f && f();
                            });
                        }
                    }
                }
            },
            resize: function(c, d, e, g) {
                c.width = -1;
                c.height = -1;
                jQuery(".flowpaper_pageword_" + c.ja + ", .flowpaper_interactiveobject_" + c.ja).remove();
                if ("FlipView" == c.aa.ba) {
                    1 != c.aa.ua || c.aa.ca.Ta ? c.aa.ca.Ta || jQuery(c.da + "_parent").transition({
                        x: 0,
                        y: c.aa.hc
                    }, 0, "snap", function() {}) : jQuery(c.da + "_parent").transition({
                        x: -(c.ed() / 4),
                        y: c.aa.hc
                    }, 0, "snap", function() {});
                    var f = c.Qg(),
                        l = c.ed();
                    c.ga(c.da + "_parent").css({
                        width: d,
                        height: f
                    });
                    c.Fd = l;
                    c.Eh = f;
                    d = c.wi();
                    c.aa.Ea && c.aa.Ea.turn("size", l, f, !1);
                    c.ga(c.da + "_panelLeft").css({
                        "margin-left": d - 22,
                        width: 22,
                        height: f - 30
                    });
                    c.ga(c.da + "_arrowleft").css({
                        top: (f - 30) / 2 + "px"
                    });
                    c.ga(c.da + "_arrowright").css({
                        top: (f - 30) / 2 + "px"
                    });
                    c.ga(c.da + "_panelRight").css({
                        width: 22,
                        height: f - 30
                    });
                    c.aa.PreviewMode ? (jQuery(c.da + "_arrowleftbottom").hide(), jQuery(c.da + "_arrowleftbottommarker").hide(), jQuery(c.da + "_arrowrightbottom").hide(), jQuery(c.da + "_arrowrightbottommarker").hide()) : (jQuery(c.da + "_arrowleftbottom").show(), jQuery(c.da + "_arrowleftbottommarker").show(), jQuery(c.da + "_arrowrightbottom").show(), jQuery(c.da + "_arrowrightbottommarker").show());
                    c.lh = null;
                    c.Cr = null;
                }
                jQuery(".flowpaper_flipview_page").addClass("flowpaper_redraw");
                for (d = 0; d < c.document.numPages; d++) {
                    c.kb(d) && c.pages[d].Xa();
                }
                "FlipView" == c.aa.ba ? (window.clearTimeout(c.Go), c.Go = setTimeout(function() {
                    c.nl && c.nl();
                    for (var d = 0; d < c.document.numPages; d++) {
                        c.kb(d) && (c.pages[d].Fa = !1, null != c.aa.renderer.resize && c.aa.renderer.resize(c.aa.renderer, c.pages[d]));
                    }
                    c.sd();
                    jQuery(c.aa).trigger("onResizeCompleted");
                    c.aa.ca.wb && jQuery("#" + c.pages.container + "_webglcanvas").css({
                        width: l,
                        height: f
                    });
                    g && g();
                }, 300)) : g && g();
            },
            je: function(c, d) {
                c.aa.PreviewMode ? c.aa.openFullScreen() : c.Zd() || ("FlipView" == c.aa.ba ? d ? c.Xa(2, {
                    jc: jQuery(c.da + "_parent").width() / 2,
                    Ic: jQuery(c.da + "_parent").height() / 2
                }) : c.Xa(2, {
                    jc: c.Pc,
                    Ic: c.Qc
                }) : c.Xa(1), c.ne());
            },
            fd: function(c, d) {
                "FlipView" == c.aa.ba ? c.Xa(1, !0, d) : c.Xa(window.FitHeightScale);
                c.ne();
            },
            Vi: function(c) {
                "FlipView" == c.aa.ba && (this.touchwipe = c.ga(c.da).touchwipe({
                    wipeLeft: function() {
                        c.zh = !0;
                        setTimeout(function() {
                            c.zh = !1;
                        }, 800);
                        c.Ef = null;
                        null == c.sa && (c.aa.Ea.turn("cornerActivated") || c.animating || 1 == c.aa.scale && c.next());
                    },
                    wipeRight: function() {
                        c.zh = !0;
                        setTimeout(function() {
                            c.zh = !1;
                        }, 800);
                        c.Ef = null;
                        c.aa.Ea.turn("cornerActivated") || c.animating || null == c.sa && 1 == c.aa.scale && c.previous();
                    },
                    preventDefaultEvents: !0,
                    min_move_x: 100,
                    min_move_y: 100
                }));
            },
            Zj: function(c) {
                eb.platform.touchdevice && !c.aa.ca.Rf && c.ga(c.da).doubletap(function(d) {
                    c.Ef = null;
                    if ("TwoPage" == c.aa.ba || "BookView" == c.aa.ba || "FlipView" == c.aa.ba) {
                        "TwoPage" != c.aa.ba && "BookView" != c.aa.ba || 1 == c.aa.scale ? 1 != c.aa.scale || "FlipView" != c.aa.ba || c.ih ? "FlipView" == c.aa.ba && 1 <= c.aa.scale && !c.$i ? c.fd() : "TwoPage" == c.aa.ba && 1 == c.aa.scale && c.fd() : c.je() : c.je(), d.preventDefault(), c.$i = !1, c.ih = !1;
                    }
                }, null, 300);
            },
            bi: function(c, d) {
                if ("FlipView" == c.aa.ba) {
                    var e = c.Qg(),
                        g = c.ed(),
                        f = c.wi(),
                        l = c.aa.ca.ig && (430 < g || c.aa.PreviewMode || c.aa.ca.Ta),
                        k = l ? 0 : f,
                        m = 22,
                        f = f - m;
                    20 > m && (m = 20);
                    var n = c.aa.ca.ec ? c.aa.ca.ec : "#555555",
                        u = c.aa.ca.$e ? c.aa.ca.$e : "#AAAAAA";
                    c.Fd = g;
                    c.Eh = e;
                    d.append("<div id='" + c.container + "_parent' style='width:100%;height:" + e + "px;z-index:10" + (!eb.browser.mozilla || !eb.platform.mac || eb.platform.mac && (18 > parseFloat(eb.browser.version) || 33 < parseFloat(eb.browser.version)) ? "" : ";transform-style:preserve-3d;") + "'>" + (l ? "<div id='" + c.container + "_panelLeft' class='flowpaper_arrow' style='cursor:pointer;opacity: 0;margin-top:15px;-moz-border-radius-topleft: 10px;border-top-left-radius: 10px;-moz-border-radius-bottomleft: 10px;border-bottom-left-radius: 10px;position:relative;float:left;background-color:" + n + ";left:0px;top:0px;height:" + (e - 30) + "px;width:" + m + "px;margin-left:" + f + "px;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;user-select: none;'><div style='position:relative;left:" + (m - (m - 0.4 * m)) / 2 + "px;top:" + (e / 2 - m) + "px' id='" + c.container + "_arrowleft' class='flowpaper_arrow'></div><div style='position:absolute;left:" + (m - (m - 0.55 * m)) / 2 + "px;bottom:0px;margin-bottom:10px;' id='" + c.container + "_arrowleftbottom' class='flowpaper_arrow flowpaper_arrow_start'></div><div style='position:absolute;left:" + (m - 0.8 * m) + "px;bottom:0px;width:2px;margin-bottom:10px;' id='" + c.container + "_arrowleftbottommarker' class='flowpaper_arrow flowpaper_arrow_start'></div></div>" : "") + "<div id='" + c.container + "' style='float:left;position:relative;height:" + e + "px;width:" + g + "px;margin-left:" + k + "px;z-index:10;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;user-select: none;' class='flowpaper_twopage_container flowpaper_hidden'></div>" + (l ? "<div id='" + c.container + "_panelRight' class='flowpaper_arrow' style='cursor:pointer;opacity: 0;margin-top:15px;-moz-border-radius-topright: 10px;border-top-right-radius: 10px;-moz-border-radius-bottomright: 10px;border-bottom-right-radius: 10px;position:relative;float:left;background-color:" + n + ";left:0px;top:0px;height:" + (e - 30) + "px;width:" + m + "px;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;user-select: none;'><div style='position:relative;left:" + (m - (m - 0.4 * m)) / 2 + "px;top:" + (e / 2 - m) + "px' id='" + c.container + "_arrowright' class='flowpaper_arrow'></div><div style='position:absolute;left:" + (m - (m - 0.55 * m)) / 2 + "px;bottom:0px;margin-bottom:10px;' id='" + c.container + "_arrowrightbottom' class='flowpaper_arrow flowpaper_arrow_end'></div><div style='position:absolute;left:" + ((m - (m - 0.55 * m)) / 2 + m - 0.55 * m) + "px;bottom:0px;width:2px;margin-bottom:10px;' id='" + c.container + "_arrowrightbottommarker' class='flowpaper_arrow flowpaper_arrow_end'></div></div>" : "") + "</div>");
                    g = Q(n);
                    jQuery(c.da + "_panelLeft").css("background-color", "rgba(" + g.r + "," + g.g + "," + g.b + "," + c.aa.ca.hg + ")");
                    jQuery(c.da + "_panelRight").css("background-color", "rgba(" + g.r + "," + g.g + "," + g.b + "," + c.aa.ca.hg + ")");
                    jQuery(c.da + "_arrowleft").dj(m - 0.4 * m, u);
                    jQuery(c.da + "_arrowright").ej(m - 0.4 * m, u);
                    c.aa.ca.kn && (jQuery(c.da + "_arrowleftbottom").dj(m - 0.55 * m, u), jQuery(c.da + "_arrowleftbottommarker").zo(m - 0.55 * m, u, jQuery(c.da + "_arrowleftbottom")), jQuery(c.da + "_arrowrightbottom").ej(m - 0.55 * m, u), jQuery(c.da + "_arrowrightbottommarker").Ao(m - 0.55 * m, u, jQuery(c.da + "_arrowrightbottom")));
                    !c.aa.ca.Ta || c.aa.gf || c.aa.ac || d.css("top", (d.height() - e) / 2.1 + "px");
                    c.aa.ca.ig || (jQuery(c.da + "_panelLeft").attr("id", c.da + "_panelLeft_disabled").css("visibility", "none"), jQuery(c.da + "_panelRight").attr("id", c.da + "_panelRight_disabled").css("visibility", "none"));
                    c.aa.PreviewMode && (jQuery(c.da + "_arrowleftbottom").hide(), jQuery(c.da + "_arrowleftbottommarker").hide(), jQuery(c.da + "_arrowrightbottom").hide(), jQuery(c.da + "_arrowrightbottommarker").hide());
                    jQuery(c.da).on(c.aa.ca.We ? "mouseup" : "mousedown", function(d) {
                        if (jQuery(d.target).hasClass("flowpaper_mark")) {
                            return !1;
                        }
                        var e = !0;
                        c.aa.ca.We && (c.Ol(), null == c.Ab || d.pageX && d.pageY && d.pageX <= c.Ab + 2 && d.pageX >= c.Ab - 2 && d.pageY <= c.pc + 2 && d.pageY >= c.pc - 2 || (e = !1), c.Ab = null, c.pc = null, c.sf && eb.browser.safari && (jQuery(".flowpaper_flipview_canvas_highres").show(), jQuery(".flowpaper_flipview_canvas").hide(), c.sf = !1));
                        if ((!c.aa.ca.We || e) && !c.aa.ca.Rf) {
                            var e = !1,
                                g = 0 < jQuery(d.target).parents(".flowpaper_page").children().find(".flowpaper_zine_page_left, .flowpaper_zine_page_left_noshadow").length;
                            c.Bf = g ? c.aa.ua - 2 : c.aa.ua - 1;
                            jQuery(d.target).hasClass("flowpaper_interactiveobject_" + c.ja) && (e = !0);
                            if (c.aa.Ea.turn("cornerActivated") || c.animating || jQuery(d.target).hasClass("turn-page-wrapper") || jQuery(d.target).hasClass("flowpaper_shadow") && jQuery(d.target).mf()) {
                                return;
                            }
                            if (c.aa.PreviewMode) {
                                c.aa.openFullScreen();
                                return;
                            }
                            eb.platform.mobilepreview || c.Zd() || (g = jQuery(c.da).Yf(d.pageX, d.pageY), e || c.aa.Fc || 1 != c.aa.scale ? !e && !c.aa.Fc && 1 < c.aa.scale && c.aa.Zoom(1, {
                                Ed: !0,
                                jc: g.x,
                                Ic: g.y
                            }) : c.aa.Zoom(2.5, {
                                Ed: !0,
                                jc: g.x,
                                Ic: g.y
                            }));
                            var f = {};
                            jQuery(jQuery(d.target).attr("class").split(" ")).each(function() {
                                "" !== this && (f[this] = this);
                            });
                            for (class_name in f) {
                                0 == class_name.indexOf("gotoPage") && c.gotoPage(parseInt(class_name.substr(class_name.indexOf("_") + 1)));
                            }
                        }
                        if (c.aa.renderer.vb && c.aa.renderer.tb && 1 < c.aa.scale) {
                            var h = 1 < c.la ? c.la - 1 : c.la;
                            setTimeout(function() {
                                1 < c.aa.scale ? (1 < c.la && c.aa.renderer.Xc(c.pages[h - 1]), c.aa.renderer.Xc(c.pages[h])) : (1 < c.la && c.aa.renderer.zc(c.pages[h - 1]), c.aa.renderer.zc(c.pages[h]));
                            }, 500);
                        }
                    });
                    jQuery(c.da + "_parent").on("mousemove", function(d) {
                        if (1 < c.aa.scale && !c.aa.Fc) {
                            if (c.aa.ca.We && "down" == c.aa.fh) {
                                c.Ab || (c.Ab = d.pageX, c.pc = d.pageY), !c.sf && eb.browser.safari && (jQuery(".flowpaper_flipview_canvas").show(), jQuery(".flowpaper_flipview_canvas_highres").hide(), c.sf = !0), eb.platform.touchdevice || c.ga(c.da + "_parent").mf() ? (c.ql && (c.Ol(), c.ql = !1), c.dk(d.pageX, d.pageY)) : (c.ia.scrollTo({
                                    left: jQuery(c.ia).scrollLeft() + (c.Ab - d.pageX) + "px",
                                    top: jQuery(c.ia).scrollTop() + (c.pc - d.pageY) + "px"
                                }, 0, {
                                    axis: "xy"
                                }), c.Ab = d.pageX + 3, c.pc = d.pageY + 3);
                            } else {
                                if (!c.aa.ca.We) {
                                    var e = c.ia.Yf(d.pageX, d.pageY);
                                    eb.platform.touchdevice || c.ga(c.da + "_parent").mf() || c.ia.scrollTo({
                                        left: d.pageX + "px",
                                        top: d.pageY + "px"
                                    }, 0, {
                                        axis: "xy"
                                    });
                                    d = e.x / jQuery(c.da + "_parent").width();
                                    e = e.y / jQuery(c.da + "_parent").height();
                                    c.Fg((jQuery(c.ia).width() + 150) * d - 20, (jQuery(c.ia).height() + 150) * e - 250);
                                }
                            }
                            c.aa.renderer.vb && c.aa.renderer.tb && !c.aa.ca.We && (e = 1 < c.la ? c.la - 1 : c.la, 1 < c.aa.scale ? (1 < c.la && c.aa.renderer.Xc(c.pages[e - 1]), c.aa.renderer.Xc(c.pages[e])) : (1 < c.la && c.aa.renderer.zc(c.pages[e - 1]), c.aa.renderer.zc(c.pages[e])));
                        }
                    });
                    jQuery(c.da + "_parent").on("touchmove", function(d) {
                        if (!eb.platform.ios && 2 == d.originalEvent.touches.length) {
                            d.preventDefault && d.preventDefault();
                            d.returnValue = !1;
                            var e = Math.sqrt((d.originalEvent.touches[0].pageX - d.originalEvent.touches[1].pageX) * (d.originalEvent.touches[0].pageX - d.originalEvent.touches[1].pageX) + (d.originalEvent.touches[0].pageY - d.originalEvent.touches[1].pageY) * (d.originalEvent.touches[0].pageY - d.originalEvent.touches[1].pageY)),
                                e = 2 * e;
                            if (null == c.sa) {
                                c.zb = c.aa.scale, c.jg = e;
                            } else {
                                c.aa.Ea.turn("setCornerDragging", !1);
                                1 > c.sa && (c.sa = 1);
                                2 < c.sa && !eb.platform.Kd && (c.sa = 2);
                                c.aa.renderer.tb && 4 < c.sa && eb.platform.ipad && (c.sa = 4);
                                !c.aa.renderer.tb && 2 < c.sa && eb.platform.ipad && (c.sa = 2);
                                var g = 1 != c.aa.ua || c.aa.ca.Ta ? 0 : -(c.ed() / 4);
                                1 < c.sa && (c.ga(c.da + "_panelLeft").hide(), c.ga(c.da + "_panelRight").hide());
                                c.ga(c.da + "_parent").transition({
                                    x: g,
                                    y: c.aa.hc,
                                    scale: c.sa
                                }, 0, "ease", function() {});
                            }
                            c.sa = c.zb + (e - c.jg) / jQuery(c.da + "_parent").width();
                        }
                        if (1 < c.aa.scale || null != c.sa && 1 < c.sa) {
                            e = d.originalEvent.touches[0] || d.originalEvent.changedTouches[0], eb.platform.ios || 2 != d.originalEvent.touches.length ? c.Ab || (c.Ab = e.pageX, c.pc = e.pageY) : c.Ab || (g = d.originalEvent.touches[1] || d.originalEvent.changedTouches[1], g.pageX > e.pageX ? (c.Ab = e.pageX + (g.pageX - e.pageX) / 2, c.pc = e.pageY + (g.pageY - e.pageY) / 2) : (c.Ab = g.pageX + (e.pageX - g.pageX) / 2, c.pc = g.pageY + (e.pageY - g.pageY) / 2)), c.sf || (jQuery(".flowpaper_flipview_canvas").show(), jQuery(".flowpaper_flipview_canvas_highres").hide(), c.sf = !0), c.dk(e.pageX, e.pageY), d.preventDefault();
                        }
                    });
                    jQuery(c.da + "_parent, " + c.da).on(!eb.platform.touchonlydevice || eb.platform.mobilepreview ? "mousedown" : "touchstart", function() {
                        c.Ef = (new Date).getTime();
                    });
                    jQuery(c.da + "_parent").on(!eb.platform.touchonlydevice || eb.platform.mobilepreview ? "mouseup" : "touchend", function(d) {
                        !c.aa.$d || null != c.sa || c.zh || c.aa.Ea.turn("cornerActivated") || c.animating ? c.aa.$d && 0 == c.aa.ca.Xb.position().top && c.aa.ca.Xb.animate({
                            opacity: 0,
                            top: "-" + c.aa.ca.Xb.height() + "px"
                        }, 300) : setTimeout(function() {
                            !jQuery(d.target).hasClass("flowpaper_arrow") && 1 == c.aa.scale && c.Ef && c.Ef > (new Date).getTime() - 1000 ? 0 == c.aa.ca.Xb.position().top ? c.aa.ca.Xb.animate({
                                opacity: 0,
                                top: "-" + c.aa.ca.Xb.height() + "px"
                            }, 300) : c.aa.ca.Xb.animate({
                                opacity: 1,
                                top: "0px"
                            }, 300) : c.Ef = null;
                        }, 600);
                        null != c.zb && (c.$i = c.zb < c.sa, c.zb = null, c.jg = null, c.sa = null, c.Ab = null, c.pc = null);
                        if (1 < c.aa.scale) {
                            var e = c.ga(c.da).css("transform") + "";
                            null != e && (e = e.replace("translate", ""), e = e.replace("(", ""), e = e.replace(")", ""), e = e.replace("px", ""), e = e.split(","), c.pd = parseFloat(e[0]), c.me = parseFloat(e[1]), isNaN(c.pd) && (c.pd = 0, c.me = 0));
                            c.Ab && 1.9 < c.aa.scale && (jQuery(".flowpaper_flipview_canvas_highres").show(), jQuery(".flowpaper_flipview_canvas").hide());
                            c.aa.renderer.vb && c.aa.renderer.tb && 1.9 < c.aa.scale && (e = 1 < c.la ? c.la - 1 : c.la, 1 < c.la && c.aa.renderer.Xc(c.pages[e - 1]), c.aa.renderer.Xc(c.pages[e]));
                        } else {
                            c.pd = 0, c.me = 0;
                        }
                        c.sf = !1;
                        c.Ab = null;
                        c.pc = null;
                    });
                    jQuery(c.da + "_parent").on("gesturechange", function(d) {
                        d.preventDefault();
                        c.aa.ca.Rf || (null == c.sa && (c.zb = d.originalEvent.scale), c.aa.Ea.turn("setCornerDragging", !1), c.sa = c.aa.scale + (c.zb > c.aa.scale ? (d.originalEvent.scale - c.zb) / 2 : 4 * (d.originalEvent.scale - c.zb)), 1 > c.sa && (c.sa = 1), 2 < c.sa && !eb.platform.Kd && (c.sa = 2), c.aa.renderer.tb && 4 < c.sa && eb.platform.ipad && (c.sa = 4), !c.aa.renderer.tb && 2 < c.sa && (eb.platform.ipad || eb.platform.iphone) && (c.sa = 2), d = 1 != c.aa.ua || c.aa.ca.Ta ? 0 : -(c.ed() / 4), c.ga(c.da + "_parent").transition({
                            x: d,
                            y: c.aa.hc,
                            scale: c.sa
                        }, 0, "ease", function() {}));
                    });
                    jQuery(c.da + "_parent").on("gestureend", function(d) {
                        d.preventDefault();
                        if (!c.aa.ca.Rf) {
                            c.ih = c.sa < c.aa.scale || c.ih;
                            c.aa.scale = c.sa;
                            for (d = 0; d < c.document.numPages; d++) {
                                c.kb(d) && (c.pages[d].scale = c.aa.scale, c.pages[d].Xa());
                            }
                            setTimeout(function() {
                                1 == c.aa.scale && (c.ga(c.da).transition({
                                    x: 0,
                                    y: 0
                                }, 0), c.aa.Ea.turn("setCornerDragging", !0));
                                for (var d = 0; d < c.document.numPages; d++) {
                                    c.kb(d) && (c.pages[d].Fa = !1);
                                }
                                c.sd();
                                jQuery(c).trigger("onScaleChanged");
                                c.sa = null;
                            }, 500);
                        }
                    });
                    jQuery(c.da + "_parent").on("mousewheel", function(d) {
                        d.preventDefault && d.preventDefault();
                        d.returnValue = !1;
                        if (!(c.Zd() || c.aa.PreviewMode || (c.aa.Ea.turn("cornerActivated") && c.aa.Ea.turn("stop"), c.aa.ca.Rf || c.aa.ca.Ym))) {
                            c.Dd || (c.Dd = 0);
                            0 < d.deltaY ? c.aa.scale + c.Dd + 2 * c.aa.document.ZoomInterval < c.aa.document.MaxZoomSize && (c.Dd = c.Dd + 2 * c.aa.document.ZoomInterval) : c.Dd = 1.2 < c.aa.scale + c.Dd - 3 * c.aa.document.ZoomInterval ? c.Dd - 3 * c.aa.document.ZoomInterval : -(c.aa.scale - 1);
                            null != c.te && (window.clearTimeout(c.te), c.te = null);
                            1.1 <= c.aa.scale + c.Dd ? (c.aa.fisheye && c.aa.fisheye.animate({
                                opacity: 0
                            }, 0, function() {
                                c.aa.fisheye.hide();
                            }), c.ga(c.da + "_panelLeft").finish(), c.ga(c.da + "_panelRight").finish(), c.ga(c.da + "_panelLeft").fadeTo("fast", 0), c.ga(c.da + "_panelRight").fadeTo("fast", 0), c.aa.Ea.turn("setCornerDragging", !1)) : (c.ga(c.da + "_panelLeft").finish(), c.ga(c.da + "_panelRight").finish(), 1 < c.la ? c.ga(c.da + "_panelLeft").fadeTo("fast", 1) : c.ga(c.da + "_panelLeft").fadeTo("fast", 0), c.aa.ua < c.aa.getTotalPages() && c.ga(c.da + "_panelRight").fadeTo("fast", 1), c.ga(c.da).transition({
                                x: 0,
                                y: 0
                            }, 0), c.aa.fisheye && (c.aa.fisheye.show(), c.aa.fisheye.animate({
                                opacity: 1
                            }, 100)), c.Ab = null, c.pc = null, c.pd = 0, c.me = 0);
                            c.le = c.aa.scale + c.Dd;
                            1 > c.le && (c.le = 1);
                            if (!(eb.browser.mozilla && 30 > eb.browser.version) && 0 < jQuery(c.da).find(d.target).length) {
                                if (1 == c.le) {
                                    c.ga(c.da + "_parent").transition({
                                        transformOrigin: "0px 0px"
                                    }, 0);
                                } else {
                                    if (1 == c.aa.scale && c.ga(c.da + "_parent").transition({
                                            transformOrigin: "0px 0px"
                                        }, 0), c.aa.Ea.turn("setCornerDragging", !1), 0 < jQuery(c.da).has(d.target).length) {
                                        d = jQuery(c.da + "_parent").Yf(d.pageX, d.pageY);
                                        var e = c.ga(c.da + "_parent").css("transformOrigin").split(" ");
                                        2 <= e.length ? (e[0] = e[0].replace("px", ""), e[1] = e[1].replace("px", ""), c.Bd = parseFloat(e[0]), c.Cd = parseFloat(e[1]), 0 == c.Bd && (c.Bd = d.x), 0 == c.Cd && (c.Cd = d.y)) : (c.Bd = d.x, c.Cd = d.y);
                                        c.ga(c.da + "_parent").transition({
                                            transformOrigin: c.Bd + "px " + c.Cd + "px"
                                        }, 0);
                                    }
                                }
                            }
                            c.ga(c.da + "_parent").transition({
                                scale: c.le
                            }, 0, "ease", function() {
                                c.aa.Ea.turn("setCornerDragging", !1);
                                jQuery(".flowpaper_flipview_canvas").show();
                                jQuery(".flowpaper_flipview_canvas_highres").hide();
                                window.clearTimeout(c.te);
                                c.te = setTimeout(function() {
                                    c.aa.scale = c.le;
                                    for (var d = c.Dd = 0; d < c.document.numPages; d++) {
                                        c.kb(d) && (c.pages[d].scale = c.aa.scale, c.pages[d].Xa());
                                    }
                                    1 == c.aa.scale && (c.ga(c.da).transition({
                                        x: 0,
                                        y: 0
                                    }, 0), c.aa.Ea.turn("setCornerDragging", !0));
                                    for (d = 0; d < c.document.numPages; d++) {
                                        c.kb(d) && (c.pages[d].Fa = !1);
                                    }
                                    c.sd();
                                    c.le = null;
                                    jQuery(c).trigger("onScaleChanged");
                                    jQuery(c.aa.ea).trigger("onScaleChanged", c.aa.scale / c.aa.document.MaxZoomSize);
                                }, 150);
                            });
                        }
                    });
                    jQuery(c.da + "_arrowleft, " + c.da + "_panelLeft").on(!eb.platform.touchonlydevice || eb.platform.mobilepreview ? "mousedown" : "touchstart", function(d) {
                        if (c.aa.ca.ig) {
                            return jQuery(d.target).hasClass("flowpaper_arrow_start") ? c.gotoPage(1) : c.previous(), !1;
                        }
                    });
                    jQuery(c.da + "_arrowright, " + c.da + "_panelRight").on(!eb.platform.touchonlydevice || eb.platform.mobilepreview ? "mousedown" : "touchstart", function(d) {
                        jQuery(d.target).hasClass("flowpaper_arrow_end") ? c.gotoPage(c.aa.getTotalPages()) : c.next();
                        return !1;
                    });
                    jQuery(d).css("overflow-y", "hidden");
                    jQuery(d).css("overflow-x", "hidden");
                    jQuery(d).css("-webkit-overflow-scrolling", "hidden");
                }
            },
            Ih: function(c, d) {
                c.Zk = d.append('<svg id="' + c.container + '_play" width="25%" onclick="$FlowPaper(\'' + c.ja + '\').openFullScreen()" style="cursor:pointer;opacity:0.8;position: absolute;top: 43%;left: 43%;margin-top: -50px;margin-left: -50px;" height="25%" viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg"><path d="M1312 896q0 37-32 55l-544 320q-15 9-32 9-16 0-32-8-32-19-32-56v-640q0-37 32-56 33-18 64 1l544 320q32 18 32 55zm128 0q0-148-73-273t-198-198-273-73-273 73-198 198-73 273 73 273 198 198 273 73 273-73 198-198 73-273zm224 0q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z" fill="#fff"/></svg>');
                jQuery("#" + c.container + "_play").bind("mouseover", function() {
                    jQuery("#" + c.container + "_play").css({
                        opacity: 1
                    });
                });
                jQuery("#" + c.container + "_play").bind("mouseout", function() {
                    jQuery("#" + c.container + "_play").css({
                        opacity: 0.8
                    });
                });
            },
            xo: function(c, d) {
                d.find("#" + c.container + "_play").remove();
                c.Zk = null;
            },
            previous: function(c) {
                if ("FlipView" == c.aa.ba) {
                    var d = c.la - 1;
                    c.aa.renderer.ce && c.Ne(d);
                    1 != c.aa.scale ? c.Xa(1, !0, function() {
                        jQuery(c.aa.ea).trigger("onScaleChanged", 1 / c.aa.document.MaxZoomSize);
                        c.aa.turn("previous");
                    }) : c.aa.turn("previous");
                }
            },
            next: function(c) {
                if ("FlipView" == c.aa.ba) {
                    var d = c.la;
                    if (d < c.aa.getTotalPages() || d == c.aa.getTotalPages() && c.aa.ca.Ta) {
                        d++, c.aa.renderer.ce && c.Ne(d), 1 != c.aa.scale ? c.Xa(1, !0, function() {
                            jQuery(c.aa.ea).trigger("onScaleChanged", 1 / c.aa.document.MaxZoomSize);
                            c.aa.turn("next");
                        }) : c.aa.turn("next");
                    }
                }
            },
            Fg: function(c, d, e) {
                var g = c.ia.width(),
                    f = c.ia.height(),
                    l = null == c.le ? c.aa.scale : c.le;
                "FlipView" == c.aa.ba && 1 < l && !eb.browser.safari ? c.ga(c.da).transition({
                    x: -c.xn(d, c.aa.scale),
                    y: -c.yn(e)
                }, 0) : "FlipView" == c.aa.ba && 1 < l && eb.browser.safari && jQuery(".flowpaper_viewer").scrollTo({
                    top: 0.9 * e / f * 100 + "%",
                    left: d / g * 100 + "%"
                }, 0, {
                    axis: "xy"
                });
            },
            Ai: function(c) {
                c = c.ga(c.da + "_parent").css("transformOrigin") + "";
                return null != c ? (c = c.replace("translate", ""), c = c.replace("(", ""), c = c.replace(")", ""), c = c.split(" "), 1 < c.length ? {
                    left: parseFloat(c[0].replace("px", "")),
                    top: parseFloat(c[1].replace("px", ""))
                } : null) : null;
            },
            Ee: function(c) {
                !eb.platform.touchdevice && "FlipView" == c.aa.ba && 1 < c.aa.scale ? jQuery(".flowpaper_viewer").scrollTo({
                    left: "50%"
                }, 0, {
                    axis: "x"
                }) : eb.platform.touchdevice || "FlipView" != c.aa.ba || 1 != c.aa.scale || c.ic() || jQuery(".flowpaper_viewer").scrollTo({
                    left: "0%",
                    top: "0%"
                }, 0, {
                    axis: "xy"
                });
            }
        };
        return f;
    }(),
    X = window.Tq = X || {},
    Y = X;
Y.Ah = {
    PI: Math.PI,
    jr: 1 / Math.PI,
    Fn: 0.5 * Math.PI,
    en: 2 * Math.PI,
    Nr: Math.PI / 180,
    Mr: 180 / Math.PI
};
Y.Wd = {
    NONE: 0,
    LEFT: -1,
    RIGHT: 1,
    X: 1,
    Y: 2,
    Z: 4,
    Xi: 0,
    vq: 1,
    yq: 2
};
Y.Zl = "undefined" !== typeof Float32Array ? Float32Array : Array;
Y.Wp = "undefined" !== typeof Float64Array ? Float64Array : Array;
Y.Xp = "undefined" !== typeof Int8Array ? Int8Array : Array;
Y.Sp = "undefined" !== typeof Int16Array ? Int16Array : Array;
Y.Up = "undefined" !== typeof Int32Array ? Int32Array : Array;
Y.Yp = "undefined" !== typeof Uint8Array ? Uint8Array : Array;
Y.Tp = "undefined" !== typeof Uint16Array ? Uint16Array : Array;
Y.Vp = "undefined" !== typeof Uint32Array ? Uint32Array : Array;
Y.Dh = Y.Zl;
!0;
! function(f, c) {
    var d = f.Ij = ring.create({
        constructor: function(d, g) {
            this.x = d === c ? 0 : d;
            this.y = g === c ? 0 : g;
        },
        x: 0,
        y: 0,
        dispose: function() {
            this.y = this.x = null;
            return this;
        },
        serialize: function() {
            return {
                name: this.name,
                x: this.x,
                y: this.y
            };
        },
        Cb: function(c) {
            c && this.name === c.name && (this.x = c.x, this.y = c.y);
            return this;
        },
        clone: function() {
            return new d(this.x, this.y);
        }
    });
}(X);
! function(f, c) {
    var d = Math.sin,
        e = Math.cos,
        g = f.Ij,
        h = f.im = ring.create({
            constructor: function(d, e, g, f) {
                this.m11 = d === c ? 1 : d;
                this.m12 = e === c ? 0 : e;
                this.m21 = g === c ? 0 : g;
                this.m22 = f === c ? 1 : f;
            },
            m11: 1,
            m12: 0,
            m21: 0,
            m22: 1,
            dispose: function() {
                this.m22 = this.m21 = this.m12 = this.m11 = null;
                return this;
            },
            serialize: function() {
                return {
                    name: this.name,
                    m11: this.m11,
                    m12: this.m12,
                    m21: this.m21,
                    m22: this.m22
                };
            },
            Cb: function(c) {
                c && this.name === c.name && (this.m11 = c.m11, this.m12 = c.m12, this.m21 = c.m21, this.m22 = c.m22);
                return this;
            },
            reset: function() {
                this.m11 = 1;
                this.m21 = this.m12 = 0;
                this.m22 = 1;
                return this;
            },
            rotate: function(c) {
                var g = e(c);
                c = d(c);
                this.m11 = g;
                this.m12 = -c;
                this.m21 = c;
                this.m22 = g;
                return this;
            },
            scale: function(d, e) {
                this.m21 = this.m12 = 0;
                this.m22 = this.m11 = 1;
                d !== c && (this.m22 = this.m11 = d);
                e !== c && (this.m22 = e);
                return this;
            },
            multiply: function(c) {
                var d = this.m11,
                    e = this.m12,
                    g = this.m21,
                    f = this.m22,
                    h = c.m11,
                    p = c.m12,
                    q = c.m21;
                c = c.m22;
                this.m11 = d * h + e * q;
                this.m12 = d * p + e * c;
                this.m21 = g * h + f * q;
                this.m22 = g * p + f * c;
                return this;
            },
            Or: function(c) {
                var d = c.x;
                c = c.y;
                return new g(this.m11 * d + this.m12 * c, this.m21 * d + this.m22 * c);
            },
            Kl: function(c) {
                var d = c.x,
                    e = c.y;
                c.x = this.m11 * d + this.m12 * e;
                c.y = this.m21 * d + this.m22 * e;
                return c;
            },
            clone: function() {
                return new h(this.m11, this.m12, this.m21, this.m22);
            }
        });
}(X);
! function(f, c) {
    var d = Math.sqrt,
        e = f.Dh,
        g = f.Vector3 = ring.create({
            constructor: function(d, g, f) {
                d && d.length ? this.qa = new e([d[0], d[1], d[2]]) : (d = d === c ? 0 : d, g = g === c ? 0 : g, f = f === c ? 0 : f, this.qa = new e([d, g, f]));
            },
            qa: null,
            dispose: function() {
                this.qa = null;
                return this;
            },
            serialize: function() {
                return {
                    name: this.name,
                    qa: this.qa
                };
            },
            Cb: function(c) {
                c && this.name === c.name && (this.qa = c.qa);
                return this;
            },
            Id: function() {
                return new e(this.qa);
            },
            Bk: function() {
                return this.qa;
            },
            setXYZ: function(c) {
                this.qa = new e(c);
                return this;
            },
            yl: function(c) {
                this.qa = c;
                return this;
            },
            clone: function() {
                return new g(this.qa);
            },
            Oq: function(c) {
                var d = this.qa;
                c = c.qa;
                return d[0] == c[0] && d[1] == c[1] && d[2] == c[2];
            },
            ds: function() {
                this.qa[0] = 0;
                this.qa[1] = 0;
                this.qa[2] = 0;
                return this;
            },
            negate: function() {
                var c = this.qa;
                return new g([-c[0], -c[1], -c[2]]);
            },
            wr: function() {
                var c = this.qa;
                c[0] = -c[0];
                c[1] = -c[1];
                c[2] = -c[2];
                return this;
            },
            add: function(c) {
                var d = this.qa;
                c = c.qa;
                return new g([d[0] + c[0], d[1] + c[1], d[2] + c[2]]);
            },
            zm: function(c) {
                var d = this.qa;
                c = c.qa;
                d[0] += c[0];
                d[1] += c[1];
                d[2] += c[2];
                return this;
            },
            Ir: function(c) {
                var d = this.qa;
                c = c.qa;
                return new g([d[0] - c[0], d[1] - c[1], d[2] - c[2]]);
            },
            Jr: function(c) {
                var d = this.qa;
                c = c.qa;
                d[0] -= c[0];
                d[1] -= c[1];
                d[2] -= c[2];
                return this;
            },
            multiplyScalar: function(c) {
                var d = this.qa;
                return new g([d[0] * c, d[1] * c, d[2] * c]);
            },
            sr: function(c) {
                var d = this.qa;
                d[0] *= c;
                d[1] *= c;
                d[2] *= c;
                return this;
            },
            multiply: function(c) {
                var d = this.qa;
                c = c.qa;
                return new g([d[0] * c[0], d[1] * c[1], d[2] * c[2]]);
            },
            ur: function(c) {
                var d = this.qa;
                c = c.qa;
                d[0] *= c[0];
                d[1] *= c[1];
                d[2] *= c[2];
                return this;
            },
            divide: function(c) {
                c = 1 / c;
                var d = this.qa;
                return new g([d[0] * c, d[1] * c, d[2] * c]);
            },
            Lq: function(c) {
                c = 1 / c;
                var d = this.qa;
                d[0] *= c;
                d[1] *= c;
                d[2] *= c;
                return this;
            },
            normalize: function() {
                var c = this.qa,
                    e = c[0],
                    f = c[1],
                    c = c[2],
                    m = e * e + f * f + c * c;
                0 < m && (m = 1 / d(m), e *= m, f *= m, c *= m);
                return new g([e, f, c]);
            },
            eo: function() {
                var c = this.qa,
                    e = c[0],
                    g = c[1],
                    f = c[2],
                    n = e * e + g * g + f * f;
                0 < n && (n = 1 / d(n), e *= n, g *= n, f *= n);
                c[0] = e;
                c[1] = g;
                c[2] = f;
                return this;
            },
            Wq: function() {
                var c = this.qa,
                    e = c[0],
                    g = c[1],
                    c = c[2];
                return d(e * e + g * g + c * c);
            },
            Gr: function(c) {
                this.eo();
                var d = this.qa;
                d[0] *= c;
                d[1] *= c;
                d[2] *= c;
                return this;
            },
            Mq: function(c) {
                var d = this.qa;
                c = c.qa;
                return d[0] * c[0] + d[1] * c[1] + d[2] * c[2];
            },
            Eq: function(c) {
                var d = this.qa,
                    e = c.qa;
                c = d[0];
                var g = d[1],
                    f = d[2],
                    u = e[0],
                    v = e[1],
                    e = e[2];
                d[0] = g * e - f * v;
                d[1] = f * u - c * e;
                d[2] = c * v - g * u;
                return this;
            },
            Kq: function(c) {
                var e = this.qa,
                    g = c.qa;
                c = e[0] - g[0];
                var f = e[1] - g[1],
                    e = e[2] - g[2];
                return d(c * c + f * f + e * e);
            },
            toString: function() {
                return "[" + this.qa[0] + " , " + this.qa[1] + " , " + this.qa[2] + "]";
            }
        });
    f.Vector3.ZERO = function() {
        return new g([0, 0, 0]);
    };
    f.Vector3.dot = function(c, d) {
        var e = c.qa,
            g = d.qa;
        return e[0] * g[0] + e[1] * g[1] + e[2] * g[2];
    };
    f.Vector3.equals = function(c, d) {
        var e = c.qa,
            g = d.qa;
        return e[0] == g[0] && e[1] == g[1] && e[2] == g[2];
    };
    f.Vector3.cross = function(c, d) {
        var e = c.qa,
            f = d.qa,
            n = e[0],
            u = e[1],
            e = e[2],
            v = f[0],
            p = f[1],
            f = f[2];
        return new g([u * f - e * p, e * v - n * f, n * p - u * v]);
    };
    f.Vector3.distance = function(c, e) {
        var g = c.qa,
            f = e.qa,
            n = g[0] - f[0],
            u = g[1] - f[1],
            g = g[2] - f[2];
        return d(n * n + u * u + g * g);
    };
    f.Vector3.Kr = function(c, d) {
        var e = c.qa,
            f = d.qa;
        return new g([e[0] + f[0], e[1] + f[1], e[2] + f[2]]);
    };
}(X);
! function(f, c) {
    var d = f.Wd,
        e = d.X,
        g = d.Y,
        h = d.Z,
        l = f.Vector3,
        k = f.Dh;
    f.Lf = ring.create({
        constructor: function(d) {
            this.qa = new k([0, 0, 0]);
            this.Nb = new k([0, 0, 0]);
            this.ratio = new k([0, 0, 0]);
            c !== d && null !== d && !1 !== d && this.xl(d);
        },
        ob: null,
        qa: null,
        Nb: null,
        ratio: null,
        dispose: function() {
            this.ratio = this.Nb = this.qa = this.ob = null;
            return this;
        },
        serialize: function() {
            return {
                ob: this.name,
                qa: this.Id(),
                Nb: this.Nb,
                ratio: this.ratio
            };
        },
        Cb: function(c) {
            c && (this.setXYZ(c.qa), this.Nb = c.Nb, this.ratio = c.ratio);
            return this;
        },
        xl: function(c) {
            this.ob = c;
            return this;
        },
        cr: function() {
            return new l(this.ratio);
        },
        ar: function(c) {
            switch (c) {
                case e:
                    return this.ratio[0];
                case g:
                    return this.ratio[1];
                case h:
                    return this.ratio[2];
            }
            return -1;
        },
        $q: function(c) {
            switch (c) {
                case e:
                    return this.Nb[0];
                case g:
                    return this.Nb[1];
                case h:
                    return this.Nb[2];
            }
            return 0;
        },
        So: function(d, e, g) {
            d = d === c ? 0 : d;
            e = e === c ? 0 : e;
            g = g === c ? 0 : g;
            this.ratio = new k([d, e, g]);
            return this;
        },
        No: function(d, e, g) {
            d = d === c ? 0 : d;
            e = e === c ? 0 : e;
            g = g === c ? 0 : g;
            this.Nb = new k([d, e, g]);
            return this;
        },
        Id: function() {
            return new k(this.qa);
        },
        Bk: function() {
            return this.qa;
        },
        Ak: function() {
            return this.qa[0];
        },
        Ck: function() {
            return this.qa[1];
        },
        Dk: function() {
            return this.qa[2];
        },
        setXYZ: function(c) {
            this.qa = new k(c);
            return this;
        },
        yl: function(c) {
            this.qa = c;
            return this;
        },
        setX: function(c) {
            this.qa[0] = c;
            return this;
        },
        setY: function(c) {
            this.qa[1] = c;
            return this;
        },
        setZ: function(c) {
            this.qa[2] = c;
            return this;
        },
        Ug: function(c) {
            switch (c) {
                case e:
                    return this.Ak();
                case g:
                    return this.Ck();
                case h:
                    return this.Dk();
            }
            return 0;
        },
        setValue: function(c, d) {
            switch (c) {
                case e:
                    this.setX(d);
                    break;
                case g:
                    this.setY(d);
                    break;
                case h:
                    this.setZ(d);
            }
            return this;
        },
        reset: function() {
            this.setXYZ(this.Nb);
            return this;
        },
        collapse: function() {
            this.Nb = this.Id();
            return this;
        },
        wk: function() {
            return new l(this.Id());
        },
        wl: function(c) {
            this.setXYZ(c.qa);
        }
    });
}(X);
! function(f, c) {
    var d = f.Wd,
        e = d.X,
        g = d.Y,
        h = d.Z,
        l = Math.min,
        k = Math.max,
        m, n;
    m = function(c) {
        return c ? c.serialize() : c;
    };
    n = f.isWorker ? function(c) {
        return c && c.ob ? (new f.Lf).Cb(c) : c;
    } : function(c, d) {
        return c && c.ob ? this.vertices[d].Cb(c) : c;
    };
    f.ug = ring.create({
        constructor: function(d) {
            this.depth = this.height = this.width = this.rc = this.dc = this.cc = this.minZ = this.minY = this.minX = this.maxZ = this.maxY = this.maxX = null;
            this.vertices = [];
            this.faces = [];
            this.mesh = null;
            c !== d && this.qj(d);
        },
        maxX: null,
        maxY: null,
        maxZ: null,
        minX: null,
        minY: null,
        minZ: null,
        cc: null,
        dc: null,
        rc: null,
        width: null,
        height: null,
        depth: null,
        vertices: null,
        faces: null,
        mesh: null,
        dispose: function() {
            this.depth = this.height = this.width = this.rc = this.dc = this.cc = this.minZ = this.minY = this.minX = this.maxZ = this.maxY = this.maxX = null;
            this.ik();
            this.jk();
            this.mesh = null;
            return this;
        },
        jk: function() {
            var c, d;
            if (this.vertices) {
                for (d = this.vertices.length, c = 0; c < d; c++) {
                    this.vertices[c].dispose();
                }
            }
            this.vertices = null;
            return this;
        },
        ik: function() {
            var c, d;
            if (this.faces) {
                for (d = this.faces.length, c = 0; c < d; c++) {
                    this.faces[c].dispose();
                }
            }
            this.faces = null;
            return this;
        },
        serialize: function() {
            return {
                mesh: this.name,
                maxX: this.maxX,
                maxY: this.maxY,
                maxZ: this.maxZ,
                minX: this.minX,
                minY: this.minY,
                minZ: this.minZ,
                cc: this.cc,
                dc: this.dc,
                rc: this.rc,
                width: this.width,
                height: this.height,
                depth: this.depth,
                vertices: this.vertices ? this.vertices.map(m) : null,
                faces: null
            };
        },
        Cb: function(c) {
            c && (f.isWorker && (this.ik(), this.jk()), this.maxX = c.maxX, this.maxY = c.maxY, this.maxZ = c.maxZ, this.minX = c.minX, this.minY = c.minY, this.minZ = c.minZ, this.cc = c.cc, this.dc = c.dc, this.rc = c.rc, this.width = c.width, this.height = c.height, this.depth = c.depth, this.vertices = (c.vertices || []).map(n, this), this.faces = null);
            return this;
        },
        qj: function(c) {
            this.mesh = c;
            this.vertices = [];
            return this;
        },
        xk: function() {
            return this.vertices;
        },
        Uq: function() {
            return this.faces;
        },
        Vj: function() {
            var c = this.vertices,
                d = c.length,
                f = d,
                m, n, t, y, E, x, A, z, F, I, J;
            for (d && (m = c[0], n = m.Id(), t = n[0], y = n[1], n = n[2], E = x = t, A = z = y, F = I = n); 0 <= --f;) {
                m = c[f], n = m.Id(), t = n[0], y = n[1], n = n[2], m.No(t, y, n), E = l(E, t), A = l(A, y), F = l(F, n), x = k(x, t), z = k(z, y), I = k(I, n);
            }
            t = x - E;
            y = z - A;
            J = I - F;
            this.width = t;
            this.height = y;
            this.depth = J;
            this.minX = E;
            this.maxX = x;
            this.minY = A;
            this.maxY = z;
            this.minZ = F;
            this.maxZ = I;
            f = k(t, y, J);
            m = l(t, y, J);
            f == t && m == y ? (this.rc = g, this.dc = h, this.cc = e) : f == t && m == J ? (this.rc = h, this.dc = g, this.cc = e) : f == y && m == t ? (this.rc = e, this.dc = h, this.cc = g) : f == y && m == J ? (this.rc = h, this.dc = e, this.cc = g) : f == J && m == t ? (this.rc = e, this.dc = g, this.cc = h) : f == J && m == y && (this.rc = g, this.dc = e, this.cc = h);
            for (f = d; 0 <= --f;) {
                m = c[f], n = m.Id(), m.So((n[0] - E) / t, (n[1] - A) / y, (n[2] - F) / J);
            }
            return this;
        },
        Eo: function() {
            for (var c = this.vertices, d = c.length; 0 <= --d;) {
                c[d].reset();
            }
            this.update();
            return this;
        },
        Sm: function() {
            for (var c = this.vertices, d = c.length; 0 <= --d;) {
                c[d].collapse();
            }
            this.update();
            this.Vj();
            return this;
        },
        Cn: function(c) {
            switch (c) {
                case e:
                    return this.minX;
                case g:
                    return this.minY;
                case h:
                    return this.minZ;
            }
            return -1;
        },
        Xq: function(c) {
            switch (c) {
                case e:
                    return this.maxX;
                case g:
                    return this.maxY;
                case h:
                    return this.maxZ;
            }
            return -1;
        },
        vk: function(c) {
            switch (c) {
                case e:
                    return this.width;
                case g:
                    return this.height;
                case h:
                    return this.depth;
            }
            return -1;
        },
        update: function() {
            return this;
        },
        Br: function() {
            return this;
        },
        Nl: function() {
            return this;
        }
    });
}(X);
! function(f) {
    var c = 0,
        d = f.Wd.NONE;
    f.Hj = ring.create({
        constructor: function(e) {
            this.id = ++c;
            this.ya = e || null;
            this.Zb = this.De = d;
            this.enabled = !0;
        },
        id: null,
        ya: null,
        De: null,
        Zb: null,
        enabled: !0,
        dispose: function(c) {
            !0 === c && this.ya && this.ya.dispose();
            this.Zb = this.De = this.name = this.ya = null;
            return this;
        },
        serialize: function() {
            return {
                od: this.name,
                params: {
                    De: this.De,
                    Zb: this.Zb,
                    enabled: !!this.enabled
                }
            };
        },
        Cb: function(c) {
            c && this.name === c.od && (c = c.params, this.De = c.De, this.Zb = c.Zb, this.enabled = c.enabled);
            return this;
        },
        enable: function(c) {
            return arguments.length ? (this.enabled = !!c, this) : this.enabled;
        },
        Cq: function(c) {
            this.De = c || d;
            return this;
        },
        Fr: function(c) {
            this.Zb = c || d;
            return this;
        },
        oh: function(c) {
            this.ya = c;
            return this;
        },
        xk: function() {
            return this.ya ? this.ya.xk() : null;
        },
        Ze: function() {
            return this;
        },
        apply: function(c) {
            var d = this;
            d._worker ? d.bind("apply", function(f) {
                d.unbind("apply");
                f && f.gg && (d.ya.Cb(f.gg), d.ya.update());
                c && c.call(d);
            }).send("apply", {
                params: d.serialize(),
                gg: d.ya.serialize()
            }) : (d.Ze(), c && c.call(d));
            return d;
        },
        toString: function() {
            return "[Modifier " + this.name + "]";
        }
    });
}(X);
! function(f) {
    f.Bh = ring.create({
        constructor: function() {
            this.Si = f.ug;
            this.Sl = f.Lf;
        },
        Si: null,
        Sl: null
    });
    var c = ring.create({
        Bn: function(c) {
            if (arguments.length) {
                var e = c.Si;
                return e ? new e : null;
            }
            return null;
        },
        Dn: function(c) {
            return c && c.od && f[c.od] ? new f[c.od] : null;
        },
        Vq: function(c) {
            return c && c.Rk && f[c.Rk] ? new f[c.Rk] : new f.Bh;
        },
        Yq: function(c) {
            return c && c.mesh && f[c.mesh] ? (new f.ug).Cb(c) : new f.ug;
        },
        dr: function(c) {
            return c && c.ob && f[c.ob] ? (new f.Lf).Cb(c) : new f.Lf;
        }
    });
    f.Fj = new c;
}(X);
! function(f) {
    function c(c) {
        return c ? c.serialize() : c;
    }
    var d = f.Fj.Bn,
        e = f.km = ring.create({
            constructor: function(c, e) {
                this.ya = null;
                this.stack = [];
                this.Mi = f.isWorker ? new f.Bh : c;
                this.ya = d(this.Mi);
                e && (this.ya.qj(e), this.ya.Vj());
            },
            Mi: null,
            ya: null,
            stack: null,
            dispose: function(c) {
                this.Mi = null;
                if (c && this.stack) {
                    for (; this.stack.length;) {
                        this.stack.pop().dispose();
                    }
                }
                this.stack = null;
                this.ya && this.ya.dispose();
                this.ya = null;
                return this;
            },
            serialize: function() {
                return {
                    od: this.name,
                    params: {
                        co: this.stack.map(c)
                    }
                };
            },
            Cb: function(c) {
                if (c && this.name === c.od) {
                    c = c.params.co;
                    var d = this.stack,
                        e;
                    if (c.length !== d.length) {
                        for (e = d.length = 0; e < c.length; e++) {
                            d.push(f.Fj.Dn(c[e]));
                        }
                    }
                    for (e = 0; e < d.length; e++) {
                        d[e] = d[e].Cb(c[e]).oh(this.ya);
                    }
                    this.stack = d;
                }
                return this;
            },
            oh: function(c) {
                this.ya = c;
                return this;
            },
            add: function(c) {
                c && (c.oh(this.ya), this.stack.push(c));
                return this;
            },
            Ze: function() {
                if (this.ya && this.stack && this.stack.length) {
                    var c = this.stack,
                        d = c.length,
                        e = this.ya,
                        f = 0;
                    for (e.Eo(); f < d;) {
                        c[f].enabled && c[f].Ze(), f++;
                    }
                    e.update();
                }
                return this;
            },
            apply: function(c) {
                var d = this;
                d._worker ? d.bind("apply", function(e) {
                    d.unbind("apply");
                    e && e.gg && (d.ya.Cb(e.gg), d.ya.update());
                    c && c.call(d);
                }).send("apply", {
                    params: d.serialize(),
                    gg: d.ya.serialize()
                }) : (d.Ze(), c && c.call(d));
                return d;
            },
            collapse: function() {
                this.ya && this.stack && this.stack.length && (this.apply(), this.ya.Sm(), this.stack.length = 0);
                return this;
            },
            clear: function() {
                this.stack && (this.stack.length = 0);
                return this;
            },
            Zq: function() {
                return this.ya;
            }
        });
    e.prototype.Sj = e.prototype.add;
}(X);
! function(f) {
    var c = f.Vector3;
    f.om = ring.create([f.Hj], {
        constructor: function(d, e, g) {
            this.$super();
            this.Vb = new c([d || 0, e || 0, g || 0]);
        },
        Vb: null,
        dispose: function() {
            this.Vb.dispose();
            this.Vb = null;
            this.$super();
            return this;
        },
        serialize: function() {
            return {
                od: this.name,
                params: {
                    Vb: this.Vb.serialize(),
                    enabled: !!this.enabled
                }
            };
        },
        Cb: function(c) {
            c && this.name === c.od && (c = c.params, this.Vb.Cb(c.Vb), this.enabled = !!c.enabled);
            return this;
        },
        Hr: function() {
            var d = this.ya;
            this.Vb = new c(-(d.minX + 0.5 * d.width), -(d.minY + 0.5 * d.height), -(d.minZ + 0.5 * d.depth));
            return this;
        },
        Ze: function() {
            for (var c = this.ya.vertices, e = c.length, g = this.Vb, f; 0 <= --e;) {
                f = c[e], f.wl(f.wk().zm(g));
            }
            this.ya.Nl(g.negate());
            return this;
        }
    });
}(X);
! function(f, c) {
    var d = f.Wd.NONE,
        e = f.Wd.LEFT,
        g = f.Wd.RIGHT,
        h = f.im,
        l = Math.atan,
        k = Math.sin,
        m = Math.cos,
        n = f.Ah.PI,
        u = f.Ah.Fn,
        v = f.Ah.en,
        p = f.Ij;
    f.am = ring.create([f.Hj], {
        constructor: function(e, g, f) {
            this.$super();
            this.Zb = d;
            this.origin = this.height = this.width = this.Md = this.min = this.max = 0;
            this.md = this.ld = null;
            this.Je = 0;
            this.Rd = !1;
            this.force = e !== c ? e : 0;
            this.offset = g !== c ? g : 0;
            f !== c ? this.lg(f) : this.lg(0);
        },
        force: 0,
        offset: 0,
        angle: 0,
        Je: 0,
        max: 0,
        min: 0,
        Md: 0,
        width: 0,
        height: 0,
        origin: 0,
        ld: null,
        md: null,
        Rd: !1,
        dispose: function() {
            this.origin = this.height = this.width = this.Md = this.min = this.max = this.Je = this.angle = this.offset = this.force = null;
            this.ld && this.ld.dispose();
            this.md && this.md.dispose();
            this.Rd = this.md = this.ld = null;
            this.$super();
            return this;
        },
        serialize: function() {
            return {
                od: this.name,
                params: {
                    force: this.force,
                    offset: this.offset,
                    angle: this.angle,
                    Je: this.Je,
                    max: this.max,
                    min: this.min,
                    Md: this.Md,
                    width: this.width,
                    height: this.height,
                    origin: this.origin,
                    ld: this.ld.serialize(),
                    md: this.md.serialize(),
                    Rd: this.Rd,
                    Zb: this.Zb,
                    enabled: !!this.enabled
                }
            };
        },
        Cb: function(c) {
            c && this.name === c.od && (c = c.params, this.force = c.force, this.offset = c.offset, this.angle = c.angle, this.Je = c.Je, this.max = c.max, this.min = c.min, this.Md = c.Md, this.width = c.width, this.height = c.height, this.origin = c.origin, this.ld.Cb(c.ld), this.md.Cb(c.md), this.Rd = c.Rd, this.Zb = c.Zb, this.enabled = !!c.enabled);
            return this;
        },
        lg: function(c) {
            this.angle = c;
            this.ld = (new h).rotate(c);
            this.md = (new h).rotate(-c);
            return this;
        },
        oh: function(c) {
            this.$super(c);
            this.max = this.Rd ? this.ya.dc : this.ya.cc;
            this.min = this.ya.rc;
            this.Md = this.Rd ? this.ya.cc : this.ya.dc;
            this.width = this.ya.vk(this.max);
            this.height = this.ya.vk(this.Md);
            this.origin = this.ya.Cn(this.max);
            this.Je = l(this.width / this.height);
            return this;
        },
        Ze: function() {
            if (!this.force) {
                return this;
            }
            for (var c = this.ya.vertices, d = c.length, f = this.Zb, h = this.width, l = this.offset, x = this.origin, A = this.max, z = this.min, F = this.Md, I = this.ld, J = this.md, H = x + h * l, w = h / n / this.force, G = h / (w * v) * v, B, M, N, C, L = 1 / h; 0 <= --d;) {
                h = c[d], B = h.Ug(A), M = h.Ug(F), N = h.Ug(z), M = I.Kl(new p(B, M)), B = M.x, M = M.y, C = (B - x) * L, e === f && C <= l || g === f && C >= l || (C = u - G * l + G * C, B = k(C) * (w + N), C = m(C) * (w + N), N = B - w, B = H - C), M = J.Kl(new p(B, M)), B = M.x, M = M.y, h.setValue(A, B), h.setValue(F, M), h.setValue(z, N);
            }
            return this;
        }
    });
}(X);
! function(f) {
    var c = f.Wd,
        d = c.X,
        e = c.Y,
        g = c.Z,
        h = f.Vector3,
        l = f.Dh,
        c = f.Kj = ring.create([f.Lf], {
            constructor: function(c, d) {
                this.mesh = c;
                this.$super(d);
            },
            mesh: null,
            dispose: function() {
                this.mesh = null;
                this.$super();
                return this;
            },
            xl: function(c) {
                this.ob = c;
                this.Nb = new l([c.x, c.y, c.z]);
                this.qa = new l(this.Nb);
                return this;
            },
            Id: function() {
                var c = this.ob;
                return new l([c.x, c.y, c.z]);
            },
            Ak: function() {
                return this.ob.x;
            },
            Ck: function() {
                return this.ob.y;
            },
            Dk: function() {
                return this.ob.z;
            },
            setXYZ: function(c) {
                var d = this.ob;
                d.x = c[0];
                d.y = c[1];
                d.z = c[2];
                return this;
            },
            setX: function(c) {
                this.ob.x = c;
                return this;
            },
            setY: function(c) {
                this.ob.y = c;
                return this;
            },
            setZ: function(c) {
                this.ob.z = c;
                return this;
            },
            reset: function() {
                var c = this.ob,
                    d = this.Nb;
                c.x = d[0];
                c.y = d[1];
                c.z = d[2];
                return this;
            },
            collapse: function() {
                var c = this.ob;
                this.Nb = new l([c.x, c.y, c.z]);
                return this;
            },
            Ug: function(c) {
                var f = this.ob;
                switch (c) {
                    case d:
                        return f.x;
                    case e:
                        return f.y;
                    case g:
                        return f.z;
                }
                return 0;
            },
            setValue: function(c, f) {
                var h = this.ob;
                switch (c) {
                    case d:
                        h.x = f;
                        break;
                    case e:
                        h.y = f;
                        break;
                    case g:
                        h.z = f;
                }
                return this;
            },
            wl: function(c) {
                var d = this.ob;
                c = c.qa;
                d.x = c[0];
                d.y = c[1];
                d.z = c[2];
                return this;
            },
            wk: function() {
                var c = this.ob;
                return new h([c.x, c.y, c.z]);
            }
        });
    c.prototype.Bk = c.prototype.Id;
    c.prototype.yl = c.prototype.setXYZ;
}(X);
! function(f) {
    var c = f.Kj;
    f.jm = ring.create([f.ug], {
        constructor: function(c) {
            this.$super(c);
        },
        qj: function(d) {
            this.$super(d);
            var e = 0;
            d = this.mesh;
            for (var g = this.vertices, f = d.geometry.vertices, l = f.length, k, e = 0; e < l;) {
                k = new c(d, f[e]), g.push(k), e++;
            }
            this.faces = null;
            return this;
        },
        update: function() {
            var c = this.mesh.geometry;
            c.verticesNeedUpdate = !0;
            c.normalsNeedUpdate = !0;
            c.Aq = !0;
            c.dynamic = !0;
            return this;
        },
        Nl: function(c) {
            var e = this.mesh.position;
            c = c.qa;
            e.x += c[0];
            e.y += c[1];
            e.z += c[2];
            return this;
        }
    });
}(X);
! function(f) {
    var c = ring.create([f.Bh], {
        constructor: function() {
            this.Si = f.jm;
            this.Sl = f.Kj;
        }
    });
    f.hm = new c;
}(X);
D = V.prototype;
D.Mk = function() {
    var f = this;
    if (f.aa.ba && (!f.aa.ba || 0 != f.aa.ba.length) && f.aa.ca.wb && !f.Gi) {
        f.Gi = !0;
        f.Rb = f.container + "_webglcanvas";
        var c = jQuery(f.da).offset(),
            d = f.aa.ka.width(),
            e = f.aa.ka.height(),
            g = c.left,
            c = c.top;
        f.kc = new THREE.Scene;
        f.Ud = jQuery(String.format("<canvas id='{0}' style='opacity:0;pointer-events:none;position:absolute;left:0px;top:0px;z-index:-1;width:100%;height:100%;'></canvas>", f.Rb, g, c));
        f.Ud.get(0).addEventListener("webglcontextlost", function(c) {
            f.Kc();
            c.preventDefault && c.preventDefault();
            f.Ud.remove();
            return !1;
        }, !1);
        f.xe = new THREE.WebGLRenderer({
            alpha: !0,
            antialias: !0,
            canvas: f.Ud.get(0)
        });
        f.xe.shadowMapType = THREE.PCFSoftShadowMap;
        f.Lb = new THREE.PerspectiveCamera(180 / Math.PI * Math.atan(e / 1398) * 2, d / e, 1, 1000);
        f.Lb.position.z = 700;
        f.kc.add(f.Lb);
        f.xe.setSize(d, e);
        0 == f.xe.context.getError() ? (jQuery(f.aa.ka).append(f.xe.domElement), f.WebGLObject = new THREE.Object3D, f.WebGLObject.scale.set(1, 1, 0.35), f.wc = new THREE.Object3D, f.WebGLObject.add(f.wc), f.kc.add(f.WebGLObject), f.Fb = new THREE.DirectionalLight(16777215), f.Fb.position.set(500, 0, 800), f.Fb.intensity = 0.1, f.kc.add(f.Fb), f.bd = new THREE.AmbientLight(16777215), f.bd.color.setRGB(1, 1, 1), f.kc.add(f.bd), f.Lb.lookAt(f.kc.position), f.Ri()) : f.Kc();
        f.Gi = !1;
    }
};
D.Kc = function() {
    this.aa.ca.wb = !1;
    for (var f = 0; f < this.document.numPages; f++) {
        this.pages[f] && this.pages[f].mesh && this.pages[f].Zm();
    }
    this.kc && (this.WebGLObject && this.kc.remove(this.WebGLObject), this.Lb && this.kc.remove(this.Lb), this.bd && this.kc.remove(this.bd), this.Fb && this.kc.remove(this.Fb), this.Ud.remove());
    this.Rb = null;
};
D.nl = function() {
    if (this.aa.ca.wb) {
        if (this.ie = [], this.Ud) {
            for (var f = 0; f < this.document.numPages; f++) {
                this.pages[f].mesh && this.pages[f].qg(!0);
            }
            var f = this.aa.ka.width(),
                c = this.aa.ka.height(),
                d = 180 / Math.PI * Math.atan(c / 1398) * 2;
            this.xe.setSize(f, c);
            this.Lb.fov = d;
            this.Lb.aspect = f / c;
            this.Lb.position.z = 700;
            this.Lb.position.x = 0;
            this.Lb.position.y = 0;
            this.Lb.updateProjectionMatrix();
            jQuery("#" + this.Rb).css("opacity", "0");
        } else {
            this.Mk();
        }
    }
};
D.Yo = function() {
    var f = jQuery(this.da).offset();
    jQuery(this.da).width();
    var c = jQuery(this.da).height();
    this.Lb.position.y = -1 * ((this.Ud.height() - c) / 2 - f.top) - this.aa.ka.offset().top;
    this.Lb.position.x = 0;
    this.Hn = !0;
};
D.Zd = function() {
    if (!this.aa.ca.wb) {
        return !1;
    }
    for (var f = this.Mf, c = 0; c < this.document.numPages; c++) {
        if (this.pages[c].Sb || this.pages[c].Tb) {
            f = !0;
        }
    }
    return f;
};
D.An = function(f) {
    return f == this.Da ? 2 : f == this.Da - 2 ? 1 : f == this.Da + 2 ? 1 : 0;
};
D.Cm = function() {
    for (var f = 0; f < this.document.numPages; f++) {
        this.pages[f].mesh && (f + 1 < this.la ? this.pages[f].Sb || this.pages[f].Tb || this.pages[f].mesh.rotation.y == -Math.PI || this.pages[f].Pn() : this.pages[f].Sb || this.pages[f].Tb || 0 == this.pages[f].mesh.rotation.y || this.pages[f].Qn(), this.pages[f].mesh.position.x = 0, this.pages[f].mesh.position.y = 0, this.pages[f].Sb || this.pages[f].Tb || (this.pages[f].mesh.position.z = this.An(f)));
    }
};
D.zj = function(f, c) {
    var d = this;
    d.Ik = !1;
    var e = d.aa.getTotalPages();
    d.Mf = !0;
    d.Dj = f;
    d.Mp = c;
    if (1 == d.aa.scale) {
        if ("next" == f && (d.Da ? d.Da = d.Da + 2 : d.Da = d.la - 1, 0 == e % 2 && d.Da == e - 2 && (d.Ik = !0), 0 != d.Da % 2 && (d.Da = d.Da - 1), d.Da >= e - 1 && 0 != e % 2)) {
            d.Mf = !1;
            return;
        }
        "previous" == f && (d.Da = d.Da ? d.Da - 2 : d.la - 3, 0 != d.Da % 2 && (d.Da += 1), d.Da >= e && (d.Da = e - 3));
        "page" == f && (d.Da = c - 3, f = d.Da >= d.la - 1 ? "next" : "previous");
        d.pages[d.Da] && !d.pages[d.Da].mesh && d.pages[d.Da].Ge();
        d.pages[d.Da - 2] && !d.pages[d.Da - 2].mesh && d.pages[d.Da - 2].Ge();
        d.pages[d.Da + 2] && !d.pages[d.Da + 2].mesh && d.pages[d.Da + 2].Ge();
        d.Yo();
        "0" == jQuery("#" + d.Rb).css("opacity") && jQuery("#" + d.Rb).animate({
            opacity: 0.5
        }, 50, function() {});
        jQuery("#" + d.Rb).animate({
            opacity: 1
        }, {
            duration: 60,
            always: function() {
                d.Cm();
                d.Mf = !1;
                if ("next" == f && !d.pages[d.Da].Sb && !d.pages[d.Da].Tb) {
                    if (0 == d.Da || d.Ik) {
                        d.aa.Ea.css({
                            opacity: 0
                        }), d.wc.position.x = d.pages[d.Da].Ac / 2 * -1, jQuery(d.da + "_parent").transition({
                            x: 0
                        }, 0, "ease", function() {});
                    }
                    0 < d.Da && (d.wc.position.x = 0);
                    jQuery("#" + d.Rb).css("z-index", 99);
                    d.Vd || (d.Vd = !0, d.fj());
                    d.Fb.intensity = 0.1;
                    d.Fb.position.set(500, 0, 800);
                    d.bd.color.setRGB(1, 1, 1);
                    var c = d.zk();
                    (new TWEEN.Tween({
                        intensity: d.Fb.intensity
                    })).to({
                        intensity: 0.6
                    }, c / 2).easing(TWEEN.Easing.Sinusoidal.EaseInOut).onUpdate(function() {
                        d.Fb.intensity = this.intensity;
                        d.bd.color.setRGB(1 - this.intensity, 1 - this.intensity, 1 - this.intensity);
                    }).onComplete(function() {
                        (new TWEEN.Tween({
                            intensity: d.Fb.intensity
                        })).to({
                            intensity: 0
                        }, c / 2).easing(TWEEN.Easing.Sinusoidal.EaseInOut).onUpdate(function() {
                            d.Fb.intensity = this.intensity;
                            d.bd.color.setRGB(1 - this.intensity, 1 - this.intensity, 1 - this.intensity);
                        }).start();
                    }).start();
                    d.pages[d.Da].rn(d.yk());
                }
                "previous" == f && (d.Mf = !1, !d.pages[d.Da] || d.pages[d.Da].Tb || d.pages[d.Da].Sb || (0 == d.Da && (d.aa.Ea.css({
                    opacity: 0
                }), jQuery(d.da + "_parent").transition({
                    x: -(d.ed() / 4)
                }, 0, "ease", function() {}), d.wc.position.x = 0), 0 < d.Da && (d.wc.position.x = 0), jQuery("#" + d.Rb).css("z-index", 99), d.Vd || (d.Vd = !0, d.fj()), d.Fb.intensity = 0.1, d.Fb.position.set(-500, 0, 800), d.bd.color.setRGB(1, 1, 1), c = d.zk(), (new TWEEN.Tween({
                    intensity: d.Fb.intensity
                })).to({
                    intensity: 0.6
                }, c / 2).easing(TWEEN.Easing.Sinusoidal.EaseInOut).onUpdate(function() {
                    d.Fb.intensity = this.intensity;
                    d.bd.color.setRGB(1 - this.intensity, 1 - this.intensity, 1 - this.intensity);
                }).onComplete(function() {
                    (new TWEEN.Tween({
                        intensity: d.Fb.intensity
                    })).to({
                        intensity: 0
                    }, c / 2).easing(TWEEN.Easing.Sinusoidal.EaseInOut).onUpdate(function() {
                        d.Fb.intensity = this.intensity;
                        d.bd.color.setRGB(1 - this.intensity, 1 - this.intensity, 1 - this.intensity);
                    }).start();
                }).start(), d.pages[d.Da].sn(d.yk())));
            }
        });
    }
};
D.zk = function() {
    var f = 639.5;
    "very fast" == this.aa.ca.Gc && (f = 100);
    "fast" == this.aa.ca.Gc && (f = 300);
    "slow" == this.aa.ca.Gc && (f = 1700);
    "very slow" == this.aa.ca.Gc && (f = 2700);
    return f;
};
D.yk = function() {
    var f = 1.5;
    "very fast" == this.aa.ca.Gc && (f = 0.4);
    "fast" == this.aa.ca.Gc && (f = 0.7);
    "slow" == this.aa.ca.Gc && (f = 2.3);
    "very slow" == this.aa.ca.Gc && (f = 3.7);
    return f;
};
D.In = function() {
    this.aa.ca.Ng ? ("next" == this.Dj && this.aa.Ea.turn("page", this.Da + 2, "instant"), "previous" == this.Dj && this.aa.Ea.turn("page", this.Da, "instant")) : this.aa.Ea.turn(this.Dj, this.Mp, "instant");
    this.Da = null;
};
D.fj = function() {
    var f, c = this;
    c.bc || (c.bc = []);
    3 > c.bc.length && (f = !0);
    if ((c.aa.ca.wb || c.Vd) && (c.Vd || f) && (c.Hd || (c.Hd = 0, c.eg = (new Date).getTime(), c.elapsedTime = 0), f = (new Date).getTime(), requestAnim(function() {
            c.fj();
        }), TWEEN.update(), c.xe.render(c.kc, c.Lb), c.Hd++, c.elapsedTime += f - c.eg, c.eg = f, 1000 <= c.elapsedTime && 4 > c.bc.length && (f = c.Hd, c.Hd = 0, c.elapsedTime -= 1000, c.bc.push(f), 3 == c.bc.length && !c.vi))) {
        c.vi = !0;
        for (var d = f = 0; 3 > d; d++) {
            f += c.bc[d];
        }
        25 > f / 3 && c.Kc();
    }
};
D.zf = function(f) {
    var c = this;
    if (f && !c.Wc) {
        c.Wc = f;
    } else {
        if (f && c.Wc && 10 > c.Wc + f) {
            c.Wc = c.Wc + f;
            return;
        }
    }
    c.xe && c.kc && c.Lb && c.Hn ? c.animating ? setTimeout(function() {
        c.zf();
    }, 500) : (0 < c.Wc ? (c.Wc = c.Wc - 1, requestAnim(function() {
        c.zf();
    })) : c.Wc = null, !c.Vd && 0 < c.Wc && c.xe.render(c.kc, c.Lb)) : c.Wc = null;
};
D.Ri = function() {
    var f = this;
    if (!f.aa.initialized) {
        setTimeout(function() {
            f.Ri();
        }, 1000);
    } else {
        if (!eb.platform.ios && (f.bc || (f.bc = []), f.Ud && f.aa.ca.wb && !f.Vd && 4 > f.bc.length)) {
            f.Hd || (f.Hd = 0, f.eg = (new Date).getTime(), f.elapsedTime = 0);
            var c = (new Date).getTime();
            requestAnim(function() {
                f.Ri();
            });
            f.Hd++;
            f.elapsedTime += c - f.eg;
            f.eg = c;
            c = f.Ud.get(0);
            if (c = c.getContext("webgl") || c.getContext("experimental-webgl")) {
                if (c.clearColor(0, 0, 0, 0), c.enable(c.DEPTH_TEST), c.depthFunc(c.LEQUAL), c.clear(c.COLOR_BUFFER_BIT | c.DEPTH_BUFFER_BIT), 1000 <= f.elapsedTime && 4 > f.bc.length && (c = f.Hd, f.Hd = 0, f.elapsedTime -= 1000, f.bc.push(c), 4 == f.bc.length && !f.vi)) {
                    f.vi = !0;
                    for (var d = c = 0; 3 > d; d++) {
                        c += f.bc[d];
                    }
                    25 > c / 3 && f.Kc();
                }
            } else {
                f.Kc();
            }
        }
    }
};
D.mo = function() {
    for (var f = this, c = !1, d = 0; d < f.document.numPages; d++) {
        if (f.pages[d].Sb || f.pages[d].Tb) {
            c = !0;
        }
    }
    c || (f.Mf = !1, 3 > f.bc ? setTimeout(function() {
        f.Zd() || (f.Vd = !1);
    }, 3000) : f.Vd = !1, f.In());
};
var na = function() {
        function f() {}
        f.prototype = {
            Nc: function(c, d) {
                return d.pages.la == d.pageNumber || d.la == d.pageNumber + 1;
            },
            vn: function(c, d, e) {
                var g = null != d.dimensions.ub ? d.dimensions.ub : d.dimensions.Ca;
                return !d.pages.ic() && c.vb && (!eb.browser.safari || eb.platform.touchdevice || eb.browser.safari && 7.1 > eb.browser.Hb) ? e : null != d.dimensions.ub && c.vb && d.aa.renderer.Ha ? d.pages.Fd / (d.aa.gf ? 1 : 2) / g : d.qb && !d.aa.renderer.Ha ? d.pages.Fd / 2 / d.aa.renderer.Ra[d.pageNumber].ub : c.vb && !d.qb && !d.aa.renderer.Ha && 1 < d.scale ? d.Bi() / g : e;
            },
            Fm: function(c, d, e) {
                jQuery(d.ma + "_textoverlay").append(e);
            },
            Xj: function(c, d, e, g) {
                var f = c.uo == g && !d.aa.renderer.vb;
                !e || e && e.attr("id") == c.so || (c.uo = g, c.so = e.attr("id"), c.vo != e.css("top") || c.wo != d.pageNumber ? (null != c.ud && c.ud.remove(), c.vo = e.css("top"), c.ud = e.wrap(jQuery(String.format("<div class='flowpaper_pageword flowpaper_pageword_" + c.ja + "' style='{0};border-width: 3px;border-style:dotted;border-color: #ee0000;'></div>", e.attr("style")))).parent(), c.ud.css({
                    "margin-left": "-3px",
                    "margin-top": "-4px",
                    "z-index": "11"
                }), jQuery(d.Ia).append(c.ud)) : f ? (c.ud.css("width", c.ud.width() + e.width()), jQuery(c.ud.children()[0]).width(c.ud.width())) : (c.ud.css("left", e.css("left")), c.ud.append(e)), e.css({
                    left: "0px",
                    top: "0px"
                }), e.addClass("flowpaper_selected"), e.addClass("flowpaper_selected_default"), e.addClass("flowpaper_selected_searchmatch"), c.wo = d.pageNumber);
            }
        };
        return f;
    }(),
    ka = function() {
        function f() {}
        f.prototype = {
            create: function(c, d) {
                if ("FlipView" == c.aa.ba && (c.Xm = 10 < c.pages.ve ? c.pages.ve : 10, !(c.Ki || c.aa.renderer.ce && !c.ib && c.pageNumber > c.Xm + 6))) {
                    c.Vc = jQuery("<div class='flowpaper_page flowpaper_page_zoomIn' id='" + c.Uc + "' style='" + c.getDimensions() + ";z-index:2;background-size:cover;background-color:#ffffff;margin-bottom:0px;'><div id='" + c.pa + "' style='height:100%;width:100%;'></div></div>");
                    c.pages.aa.Ea && c.aa.renderer.ce ? c.pages.aa.Ea.turn("addPage", c.Vc, c.pageNumber + 1) : jQuery(d).append(c.Vc);
                    var e = c.Mg() * c.ab,
                        g = c.Va() / e;
                    null != c.dimensions.ub && c.vb && c.aa.renderer.Ha && (g = c.pages.Fd / 2 / e);
                    c.Qi = g;
                    c.uf(g);
                    c.Ki = !0;
                    c.ib = !0;
                    c.aa.renderer.Jd(c);
                    c.show();
                    c.height = c.ga(c.Ia).height();
                    c.Al();
                    c.Ge && c.Ge();
                }
            },
            Nn: function(c) {
                var d = c.Mg() * c.ab,
                    e = c.Va() / d;
                null != c.dimensions.ub && c.vb && c.aa.renderer.Ha && (e = c.pages.Fd / 2 / d);
                c.Qi = e;
                c.uf(e);
            },
            ge: function(c) {
                return c.pages.ge() / (c.aa.ca.Ta ? 1 : 2);
            },
            hf: function(c) {
                return c.pages.hf();
            },
            getDimensions: function(c) {
                if ("FlipView" == c.aa.ba) {
                    return c.ia.width(), "position:absolute;left:0px;top:0px;width:" + c.Va(c) + ";height:" + c.Za(c);
                }
            },
            Va: function(c) {
                if ("FlipView" == c.aa.ba) {
                    return c.pages.Fd / (c.aa.ca.Ta ? 1 : 2) * c.scale;
                }
            },
            zi: function(c) {
                if ("FlipView" == c.aa.ba) {
                    return c.pages.Fd / (c.aa.ca.Ta ? 1 : 2) * 1;
                }
            },
            Bi: function(c) {
                if ("FlipView" == c.aa.ba) {
                    return c.pages.Fd / (c.aa.ca.Ta ? 1 : 2);
                }
            },
            Za: function(c) {
                if ("FlipView" == c.aa.ba) {
                    return c.pages.Eh * c.scale;
                }
            },
            yi: function(c) {
                if ("FlipView" == c.aa.ba) {
                    return 1 * c.pages.Eh;
                }
            },
            Lc: function() {
                return 0;
            },
            Nc: function(c) {
                var d = c.aa.ca.wb;
                if ("FlipView" == c.aa.ba) {
                    return c.pages.la >= c.pageNumber - (d ? 3 : 2) && c.pages.la <= c.pageNumber + (d ? 5 : 4);
                }
            },
            unload: function(c) {
                var d = c.ma;
                0 == jQuery(d).length && (d = jQuery(c.Vc).find(c.ma));
                (c.pageNumber < c.pages.la - 15 || c.pageNumber > c.pages.la + 15) && c.Vc && !c.Vc.parent().hasClass("turn-page-wrapper") && !c.yb && 0 != c.pageNumber && (jQuery(d).find("*").unbind(), jQuery(d).find("*").remove(), c.initialized = !1, c.qc = !1);
            }
        };
        U.prototype.Xf = function() {
            return eb.platform.touchdevice ? "FlipView" == this.aa.ba ? !this.aa.ca.Ta && window.devicePixelRatio && 1 < window.devicePixelRatio ? 1.9 : 2.6 : 1 : "FlipView" == this.aa.ba ? 2 : 1;
        };
        return f;
    }();
D = U.prototype;
D.Ge = function() {
    var f = this;
    if (0 == f.pageNumber % 2 && 1 == f.scale && f.aa.ca.wb) {
        if (f.mesh && f.pages.wc.remove(f.mesh), f.pages.Rb || f.pages.Mk(), f.pages.Gi) {
            setTimeout(function() {
                f.Ge();
            }, 200);
        } else {
            f.Ac = f.Va(f);
            f.Nd = f.Za(f);
            f.angle = 0.25 * Math.PI * this.Ac / this.Nd;
            for (var c = 0; 6 > c; c++) {
                c != f.Ba.jb || f.$a[f.Ba.jb] ? c != f.Ba.back || f.$a[f.Ba.back] ? f.$a[c] || c == f.Ba.back || c == f.Ba.jb || (f.$a[c] = new THREE.MeshPhongMaterial({
                    color: f.ko
                }), f.$a[c].name = "edge") : (f.$a[f.Ba.back] = new THREE.MeshPhongMaterial({
                    map: null,
                    overdraw: !0
                }), f.$a[f.Ba.back].name = "back", f.Qj(f.pageNumber, f.Ac, f.Nd, f.Ba.back, function(c) {
                    f.Sc || (f.$a[f.Ba.back].map = THREE.ImageUtils.loadTexture(c));
                })) : (f.$a[f.Ba.jb] = new THREE.MeshPhongMaterial({
                    map: null,
                    overdraw: !0
                }), f.$a[f.Ba.jb].name = "front", f.Qj(f.pageNumber, f.Ac, f.Nd, f.Ba.jb, function(c) {
                    f.Sc || (f.$a[f.Ba.jb].map = THREE.ImageUtils.loadTexture(c));
                }));
            }
            f.mesh = new THREE.Mesh(new THREE.BoxGeometry(f.Ac, f.Nd, 0.1, 10, 10, 1), new THREE.MeshFaceMaterial(f.$a));
            f.mesh.overdraw = !0;
            f.ya = new X.km(X.hm, f.mesh);
            f.Vb = new X.om(f.Ac / 2, 0, 0);
            f.ya.Sj(f.Vb);
            f.ya.collapse();
            f.Yb = new X.am(0, 0, 0);
            f.Yb.Zb = X.Wd.LEFT;
            f.Nd > f.Ac && (f.Yb.Rd = !0);
            f.ya.Sj(f.Yb);
            f.pages.wc.add(f.mesh);
            f.mesh.position.x = 0;
            f.mesh.position.z = -1;
            f.ah && (f.mesh.rotation.y = -Math.PI);
            f.bh && (f.mesh.rotation.y = 0);
        }
    }
};
D.Qj = function(f, c, d, e, g) {
    var h = "image/jpeg",
        l = 0.95,
        k = this,
        m = new Image,
        n;
    k.pages.ie || (k.pages.ie = []);
    h = "image/jpeg";
    l = l || 0.92;
    e == k.Ba.jb && k.pages.ie[k.Ba.jb] ? g(k.pages.ie[k.Ba.jb]) : e == k.Ba.back && k.pages.ie[k.Ba.back] ? g(k.pages.ie[k.Ba.back]) : (m.onload = function() {
        var u = document.createElement("canvas");
        u.width = c;
        u.height = d;
        n = u.getContext("2d");
        n.Hf = n.mozImageSmoothingEnabled = n.imageSmoothingEnabled = !0;
        n.fillStyle = "white";
        n.fillRect(0, 0, u.width, u.height);
        n.drawImage(m, u.width / 2 + (k.Lc() - 10), u.height / 2, 24, 8);
        if (k.aa.Uf) {
            if (e == k.Ba.back) {
                n.beginPath();
                n.strokeStyle = "transparent";
                n.rect(0.65 * c, 0, 0.35 * c, d);
                var v = n.createLinearGradient(0, 0, c, 0);
                v.addColorStop(0.93, "rgba(255, 255, 255, 0)");
                v.addColorStop(0.96, "rgba(170, 170, 170, 0.05)");
                v.addColorStop(1, "rgba(125, 124, 125, 0.3)");
                n.fillStyle = v;
                n.fill();
                n.stroke();
                n.closePath();
                v = u.toDataURL(h, l);
                k.pages.ie[k.Ba.back] = v;
                g(v);
            }
            e == k.Ba.jb && 0 != f && (n.beginPath(), n.strokeStyle = "transparent", n.rect(0, 0, 0.35 * c, d), v = n.createLinearGradient(0, 0, 0.07 * c, 0), v.addColorStop(0.07, "rgba(125, 124, 125, 0.3)"), v.addColorStop(0.93, "rgba(255, 255, 255, 0)"), n.fillStyle = v, n.fill(), n.stroke(), n.closePath(), v = u.toDataURL(h, l), k.pages.ie[k.Ba.jb] = v, g(v));
        }
    }, m.src = k.jd);
};
D.qg = function(f) {
    if (this.mesh && this.Sc || f) {
        this.Ml(), this.ya.dispose(), this.Vb.dispose(), this.ya = this.mesh = this.Vb = null, this.$a = [], this.$c = this.resources = null, this.Ge(), this.Sc = !1;
    }
};
D.Zm = function() {
    this.mesh && this.Sc && (this.Ml(), this.ya.dispose(), this.Vb.dispose(), this.ya = this.mesh = this.Vb = null, this.$a = [], this.resources = null, this.Sc = !1);
};
D.Ml = function() {
    var f = this.mesh;
    if (f) {
        for (var c = 0; c < f.material.materials.length; c++) {
            f.material.materials[c].map && f.material.materials[c].map.dispose(), f.material.materials[c].dispose();
        }
        f.geometry.dispose();
        this.pages.wc.remove(f);
    }
};
D.hd = function(f, c) {
    var d = this;
    if (d.aa.ca.wb && !d.Sc && 0 == d.pageNumber % 2 && 1 == d.aa.scale && 1 == d.scale) {
        d.Sc = !0;
        d.dh = !0;
        d.Ac = d.Va(d);
        d.Nd = d.Za(d);
        d.angle = 0.25 * Math.PI * this.Ac / this.Nd;
        for (var e = 0; 6 > e; e++) {
            e == d.Ba.jb ? d.loadResources(d.pageNumber, function() {
                d.jl(d.pageNumber, d.Ba.jb, f, d.Ac, d.Nd, function(c) {
                    d.$a[d.Ba.jb] && (d.$a[d.Ba.jb].map = null);
                    d.pages.zf(2);
                    d.$a[d.Ba.jb] = new THREE.MeshPhongMaterial({
                        map: THREE.ImageUtils.loadTexture(c),
                        overdraw: !0
                    });
                    d.mesh && d.mesh.material.materials && d.mesh.material.materials && (d.mesh.material.materials[d.Ba.jb] = d.$a[d.Ba.jb]);
                    d.dh && d.$a[d.Ba.jb] && d.$a[d.Ba.jb].map && d.$a[d.Ba.back] && d.$a[d.Ba.back].map && (d.dh = !1, d.pages.zf(2));
                });
            }) : e == d.Ba.back && d.loadResources(d.pageNumber + 1, function() {
                d.jl(d.pageNumber + 1, d.Ba.back, c, d.Ac, d.Nd, function(c) {
                    d.$a[d.Ba.back] && (d.$a[d.Ba.back].map = null);
                    d.pages.zf(2);
                    d.$a[d.Ba.back] = new THREE.MeshPhongMaterial({
                        map: THREE.ImageUtils.loadTexture(c),
                        overdraw: !0
                    });
                    d.mesh && d.mesh.material.materials && d.mesh.material.materials && (d.mesh.material.materials[d.Ba.back] = d.$a[d.Ba.back]);
                    d.dh && d.$a[d.Ba.jb] && d.$a[d.Ba.jb].map && d.$a[d.Ba.back] && d.$a[d.Ba.back].map && (d.dh = !1, d.pages.zf(2));
                });
            });
        }
    }
};
D.loadResources = function(f, c) {
    var d = this,
        e = d.pages.getPage(f);
    if (e) {
        if (null == e.resources && (e.resources = [], d.aa.Aa[f])) {
            for (var g = 0; g < d.aa.Aa[f].length; g++) {
                if ("image" == d.aa.Aa[f][g].type || "video" == d.aa.Aa[f][g].type) {
                    var h = d.aa.Aa[f][g].src,
                        l = new Image;
                    l.loaded = !1;
                    l.setAttribute("data-x", d.aa.Aa[f][g].Di ? d.aa.Aa[f][g].Di : d.aa.Aa[f][g].Tl);
                    l.setAttribute("data-y", d.aa.Aa[f][g].Ei ? d.aa.Aa[f][g].Ei : d.aa.Aa[f][g].Ul);
                    l.setAttribute("data-width", d.aa.Aa[f][g].width);
                    l.setAttribute("data-height", d.aa.Aa[f][g].height);
                    jQuery(l).bind("load", function() {
                        this.loaded = !0;
                        d.pl(f) && c();
                    });
                    l.src = h;
                    e.resources.push(l);
                }
            }
        }
        d.pl(f) && c();
    }
};
D.pl = function(f) {
    var c = !0;
    f = this.pages.getPage(f);
    if (!f.resources) {
        return !1;
    }
    for (var d = 0; d > f.resources.length; d++) {
        f.resources[d].loaded || (c = !1);
    }
    return c;
};
D.Pn = function() {
    this.mesh.rotation.y = -Math.PI;
    this.page.Sb = !1;
    this.page.ah = !0;
    this.page.Tb = !1;
    this.page.bh = !1;
};
D.Qn = function() {
    this.mesh.rotation.y = 0;
    this.page.Sb = !1;
    this.page.bh = !0;
    this.page.Tb = !1;
    this.page.ah = !1;
};
D.jl = function(f, c, d, e, g, h) {
    var l = "image/jpeg",
        k = 0.95,
        m = this,
        n = new Image,
        u, v, p, q, l = 0 == d.indexOf("data:image/png") ? "image/png" : "image/jpeg",
        k = k || 0.92;
    n.src = d;
    jQuery(n).bind("load", function() {
        p = this.naturalWidth;
        q = this.naturalHeight;
        u = document.createElement("canvas");
        p /= 2;
        q /= 2;
        if (p < e || q < g) {
            p = e, q = g;
        }
        p < d.width && (p = d.width);
        q < d.height && (q = d.height);
        u.width = p;
        u.height = q;
        v = u.getContext("2d");
        v.clearRect(0, 0, u.width, u.height);
        v.fillStyle = "rgba(255, 255, 255, 1)";
        v.fillRect(0, 0, p, q);
        v.drawImage(n, 0, 0, p, q);
        var r = p / (m.Mg() * m.ab),
            t = m.pages.getPage(f).resources;
        if (t) {
            for (var y = 0; y < t.length; y++) {
                v.drawImage(t[y], parseFloat(t[y].getAttribute("data-x")) * r, parseFloat(t[y].getAttribute("data-y")) * r, parseFloat(t[y].getAttribute("data-width")) * r, parseFloat(t[y].getAttribute("data-height")) * r);
            }
        }
        m.aa.Uf && (c == m.Ba.back && (v.beginPath(), v.strokeStyle = "transparent", v.rect(0.65 * p, 0, 0.35 * p, q), r = v.createLinearGradient(0, 0, p, 0), r.addColorStop(0.93, "rgba(255, 255, 255, 0)"), r.addColorStop(0.96, "rgba(170, 170, 170, 0.05)"), r.addColorStop(1, "rgba(125, 124, 125, 0.3)"), v.fillStyle = r, v.fill(), v.stroke(), v.closePath()), c == m.Ba.jb && 0 != f && (v.beginPath(), v.strokeStyle = "transparent", v.rect(0, 0, 0.35 * p, q), r = v.createLinearGradient(0, 0, 0.07 * p, 0), r.addColorStop(0.07, "rgba(125, 124, 125, 0.3)"), r.addColorStop(0.93, "rgba(255, 255, 255, 0)"), v.fillStyle = r, v.fill(), v.stroke(), v.closePath()));
        h(u.toDataURL(l, k));
    });
};
D.rn = function(f) {
    var c = this;
    f && (c.duration = f);
    f = 415 * c.duration;
    var d = 315 * c.duration,
        e = 210 * c.duration;
    c.Sb || c.Tb || (c.Sb = !0, c.Yb.lg(-0.15), c.Yb.force = 0, c.Yb.offset = 0, c.ya.apply(), c.to = {
        angle: c.mesh.rotation.y,
        t: -1,
        If: 0,
        page: c,
        force: c.force,
        offset: c.offset
    }, (new TWEEN.Tween(c.to)).to({
        angle: -Math.PI,
        If: 1,
        t: 1
    }, f).easing(TWEEN.Easing.Sinusoidal.EaseInOut).onUpdate(c.cl).start(), (new TWEEN.Tween(c.to)).to({
        force: 0.6
    }, d).easing(TWEEN.Easing.Quadratic.EaseInOut).onUpdate(c.xf).onComplete(function() {
        (new TWEEN.Tween(c.to)).to({
            force: 0,
            offset: 1
        }, e).easing(TWEEN.Easing.Sinusoidal.EaseOut).onUpdate(c.xf).onComplete(c.sk).start();
    }).start(), (new TWEEN.Tween(c.to)).to({
        offset: 0.1
    }, d).easing(TWEEN.Easing.Quadratic.EaseOut).onUpdate(c.xf).start(), c.mesh.position.z = 2);
};
D.sn = function(f) {
    var c = this;
    f && (c.duration = f);
    f = 415 * c.duration;
    var d = 315 * c.duration,
        e = 210 * c.duration;
    c.Tb || c.Sb || (c.Tb = !0, c.Yb.lg(-0.15), c.Yb.force = 0, c.Yb.offset = 0, c.ya.apply(), c.to = {
        angle: c.mesh.rotation.y,
        t: -1,
        If: 0,
        page: c,
        force: c.force,
        offset: c.offset
    }, (new TWEEN.Tween(c.to)).to({
        angle: 0,
        If: 1,
        t: 1
    }, f).easing(TWEEN.Easing.Sinusoidal.EaseInOut).onUpdate(c.cl).start(), (new TWEEN.Tween(c.to)).to({
        force: -0.6
    }, d).easing(TWEEN.Easing.Quadratic.EaseInOut).onUpdate(c.xf).onComplete(function() {
        (new TWEEN.Tween(c.to)).to({
            force: 0,
            offset: 1
        }, e).easing(TWEEN.Easing.Sinusoidal.EaseOut).onUpdate(c.xf).onComplete(c.sk).start();
    }).start(), (new TWEEN.Tween(c.to)).to({
        offset: 0.1
    }, d).easing(TWEEN.Easing.Quadratic.EaseOut).onUpdate(c.xf).start(), c.mesh.position.z = 2);
};
D.cl = function() {
    this.page.mesh.rotation.y = this.angle;
    this.page.Sb && 0 == this.page.pageNumber && (this.page.pages.wc.position.x = (1 - this.If) * this.page.pages.wc.position.x);
    this.page.Tb && 0 == this.page.pageNumber && (this.page.pages.wc.position.x = (1 - this.If) * this.page.pages.wc.position.x - this.If * this.page.Ac * 0.5);
};
D.xf = function() {
    this.page.Yb.force = this.force;
    this.page.Yb.offset = this.offset;
    this.page.ya.apply();
};
D.sk = function() {
    this.page.Sb ? (this.page.Sb = !1, this.page.ah = !0, this.page.Tb = !1, this.page.bh = !1, this.page.mesh.position.z = 2) : this.page.Tb && (this.page.Sb = !1, this.page.bh = !0, this.page.Tb = !1, this.page.ah = !1, this.page.mesh.position.z = 2);
    this.page.Yb.force = 0;
    this.page.Yb.lg(0);
    this.page.Yb.offset = 0;
    this.page.ya.apply();
    this.page.pages.mo();
};
var oa = "undefined" == typeof window;
oa && (window = []);
var FlowPaperViewer_HTML = window.FlowPaperViewer_HTML = function() {
    function f(c) {
        window.zine = !0;
        this.config = c;
        this.Ji = this.config.instanceid;
        this.document = this.config.document;
        this.ja = this.config.rootid;
        this.ia = {};
        this.ad = this.ka = null;
        this.selectors = {};
        this.ba = "Portrait";
        this.Gb = null != c.document.InitViewMode && "undefined" != c.document.InitViewMode && "" != c.document.InitViewMode ? c.document.InitViewMode : window.zine ? "FlipView" : "Portrait";
        this.initialized = !1;
        this.ue = "flowpaper_selected_default";
        this.hb = {};
        this.Aa = [];
        this.vm = "data:image/gif;base64,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%3D";
        this.Mj = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAAXNSR0IArs4c6QAAAAZiS0dEAFEAUQBRjSJ44QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9wCCgEMO6ApCe8AAAFISURBVCjPfZJBi49hFMV/521MUYxEsSGWDDWkFKbkA/gAajaytPIFLKx8BVkodjP5AINGU0xZKAslC3Ys2NjP+VnM++rfPzmb23065z6de27aDsMwVD0C3AfOAYeB38BP9fEwDO/aMgwDAAFQDwKbwC9gZxScUM8Al5M8SPJ0Eu5JYV0FeAZcBFaAxSSPkjwHnrQ9Pf1E22XVsX5s+1m9o54cB9J2q+361KM+VN+ot9uqrjIH9VJbpz7qOvAeuAIcSnJzThA1SXaTBGAAvgCrwEvg0yxRXUhikrOjZ1RQz7uHFfUu/4C60fb16G9hetxq+1a9Pkdears2Dt1Rj87mdAx4BfwAttWvSQ4AV9W1aYlJtoFbmQJTjwP3gAvAIlDgG7CsXvu7uWQzs+cxmj0F7Fd3k3wfuRvqDWAfM+HxP6hL6oe2tn3xB7408HFbpc41AAAAAElFTkSuQmCC";
        this.Fh = "data:image/png;base64,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%3D";
        this.wm = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAAARVBMVEX///////////////////////////////////////////////////////////////////////////////////////////+QFj7cAAAAFnRSTlMAHDE8PkJmcXR4eY+Vs8fL09Xc5vT5J4/h6AAAAFtJREFUeNqt0kkOgDAMQ9EPZSgztMX3PyoHiMKi6ttHkZ1QI+UDpmwkXl0QZbwUnTDLKEg3LLIIQw/dYATa2vYI425sSA+ssvw8/szPnrb83vyu/Tz+Tf0/qPABFzEW/E1C02AAAAAASUVORK5CYII=";
        this.Kp = this.ja + "_textoverlay";
        this.Cj = "#" + this.Kp;
        this.ua = 1;
        this.renderer = this.config.renderer;
        this.Ya = "toolbar_" + this.ja;
        this.ea = "#" + this.Ya;
        this.Fc = !1;
        this.scale = this.config.document.Scale;
        this.resources = new FlowPaper_Resources(this);
        this.$d = !1;
        this.Of = 0;
        this.linkColor = "#72e6ff";
        this.ke = 0.4;
    }
    f.prototype = {
        ga: function(c) {
            if (0 < c.indexOf("undefined")) {
                return jQuery(null);
            }
            this.selectors || (this.selectors = {});
            this.selectors[c] || (this.selectors[c] = jQuery(c));
            return this.selectors[c];
        },
        na: function() {
            return this.ca ? this.ca.na : "";
        },
        loadFromUrl: function(c) {
            var d = this;
            d.kg();
            var e;
            window.annotations && d.plugin && d.plugin.clearMarks();
            if (d.pages) {
                for (var g = 0; g < d.document.numPages; g++) {
                    d.pages.pages[g] && delete d.pages.pages[g];
                }
            }
            eb.browser.rb.xp && c.PDFFile ? e = new CanvasPageRenderer(this.ja, c.PDFFile, d.config.jsDirectory, {
                jsonfile: c.jsonfile,
                pageImagePattern: c.pageImagePattern,
                JSONDataType: d.renderer.config.JSONDataType,
                signature: d.renderer.config.signature
            }) : c.JSONFile && c.IMGFiles && (e = new ImagePageRenderer(this.ja, {
                jsonfile: c.JSONFile,
                pageImagePattern: c.IMGFiles,
                JSONDataType: d.renderer.config.JSONDataType,
                signature: d.renderer.config.signature
            }, d.config.jsDirectory));
            if (d.renderer = e) {
                d.dg = "", d.sj(), d.renderer = e, e.initialize(function() {
                    d.document.numPages = e.getNumPages();
                    d.document.dimensions = e.getDimensions();
                    d.document.StartAtPage = c.StartAtPage;
                    d.loadDoc(e, e.getNumPages());
                });
            }
        },
        loadDoc: function(c, d) {
            this.initialized = !1;
            this.document.numPages = d;
            this.renderer = c;
            this.show();
        },
        getDimensions: function(c) {
            return this.renderer.getDimensions(c);
        },
        cn: function(c) {
            if (jQuery(c.target).hasClass("flowpaper_note_container") && eb.platform.touchdevice) {
                return window.Db = !1, !0;
            }
            var d = eb.platform.touchdevice && "undefined" !== typeof c.originalEvent.touches ? c.originalEvent.touches[0].pageX : c.pageX,
                e = eb.platform.touchdevice && "undefined" !== typeof c.originalEvent.touches ? c.originalEvent.touches[0].pageY : c.pageY;
            if (this.Fc || eb.platform.touchdevice) {
                c.target && c.target.id && 0 <= c.target.id.indexOf("page") && 0 <= c.target.id.indexOf("word") && (hoverPage = parseInt(c.target.id.substring(c.target.id.indexOf("_") + 1)), hoverPageObject = T(this.ja));
                if (!hoverPageObject && !window.Db || !window.Db) {
                    return !0;
                }
                eb.platform.touchdevice && (c.preventDefault && c.preventDefault(), c.stopPropagation && c.stopPropagation(), this.pages.jScrollPane && this.pages.jScrollPane.data("jsp").disable());
                this.ba == this.na() && 1 < this.scale ? window.b = hoverPageObject.Uk(c.target.id) : window.b = hoverPageObject.match({
                    left: d,
                    top: e
                }, !1);
                null != window.b && null != window.a && window.a.pageNumber != window.b.pageNumber && (window.a = hoverPageObject.match({
                    left: d - 1,
                    top: e - 1
                }, !1));
                this.Fe(!0);
                this.be = hoverPageObject.bf(!0, this.ue);
            } else {
                if (c.target && c.target.id && 0 <= c.target.id.indexOf("page") && (hoverPage = parseInt(c.target.id.substring(c.target.id.indexOf("_") + 1)), hoverPageObject = T(this.ja)), hoverPageObject && hoverPageObject.match({
                        left: d,
                        top: e
                    }, !0), !hoverPageObject && !window.Db) {
                    return !0;
                }
            }
        },
        Fe: function(c) {
            eb.platform.touchdevice || (this.be = null);
            this.Fc && (jQuery(".flowpaper_pageword_" + this.ja).removeClass("flowpaper_selected"), jQuery(".flowpaper_pageword_" + this.ja).removeClass("flowpaper_selected_default"));
            c && jQuery(".flowpaper_pageword_" + this.ja).each(function() {
                jQuery(this).hasClass("flowpaper_selected_yellow") && !jQuery(this).data("isMark") && jQuery(this).removeClass("flowpaper_selected_yellow");
                jQuery(this).hasClass("flowpaper_selected_orange") && !jQuery(this).data("isMark") && jQuery(this).removeClass("flowpaper_selected_orange");
                jQuery(this).hasClass("flowpaper_selected_green") && !jQuery(this).data("isMark") && jQuery(this).removeClass("flowpaper_selected_green");
                jQuery(this).hasClass("flowpaper_selected_blue") && !jQuery(this).data("isMark") && jQuery(this).removeClass("flowpaper_selected_blue");
                jQuery(this).hasClass("flowpaper_selected_strikeout") && !jQuery(this).data("isMark") && jQuery(this).removeClass("flowpaper_selected_strikeout");
            });
        },
        dn: function(c) {
            this.fh = "up";
            this.Mc = this.Li = !1;
            this.Tk = null;
            if (!this.pages || !this.pages.animating) {
                if (jQuery(c.target).hasClass("flowpaper_searchabstract_result") || jQuery(c.target).parent().hasClass("flowpaper_searchabstract_result") || jQuery(c.target).hasClass("flowpaper_note_container")) {
                    return !0;
                }
                if (this.Fc || eb.platform.touchdevice) {
                    if (hoverPageObject) {
                        if (eb.platform.touchdevice) {
                            var d = null;
                            "undefined" != typeof c.originalEvent.touches && (d = c.originalEvent.touches[0] || c.originalEvent.changedTouches[0]);
                            null != d && this.Pc == d.pageX && this.Qc == d.pageY && (this.Fe(), this.be = hoverPageObject.bf(window.Db, this.ue));
                            null != d && (this.Pc = d.pageX, this.Qc = d.pageY);
                            this.pages.jScrollPane && this.pages.jScrollPane.data("jsp").enable();
                        } else {
                            window.b = hoverPageObject.match({
                                left: c.pageX,
                                top: c.pageY
                            }, !1);
                        }
                        null != this.be && this.ia.trigger("onSelectionCreated", this.be.text);
                        window.Db = !1;
                        window.a = null;
                        window.b = null;
                    }
                } else {
                    hoverPageObject && (window.b = hoverPageObject.match({
                        left: c.pageX,
                        top: c.pageY
                    }, !1), window.Db = !1, this.Fe(), this.be = hoverPageObject.bf(!1, this.ue));
                }
            }
        },
        bn: function(c) {
            var d = this;
            d.fh = "down";
            if (jQuery(c.target).hasClass("flowpaper_note_textarea") || "INPUT" == jQuery(c.target).get(0).tagName) {
                window.b = null, window.a = null;
            } else {
                if (!d.pages.animating) {
                    var e = eb.platform.touchdevice && "undefined" !== typeof c.originalEvent.touches ? c.originalEvent.touches[0].pageX : c.pageX,
                        g = eb.platform.touchdevice && "undefined" !== typeof c.originalEvent.touches ? c.originalEvent.touches[0].pageY : c.pageY;
                    d.Pc = e;
                    d.Qc = g;
                    eb.platform.touchdevice && (eb.platform.touchonlydevice && window.annotations && (d.Fc = !0, d.Fe(!0)), window.clearTimeout(d.$n), d.Tk = (new Date).getTime(), document.activeElement && jQuery(document.activeElement).hasClass("flowpaper_note_textarea") && document.activeElement.blur(), d.$n = setTimeout(function() {
                        if (null != d.Tk && c.originalEvent.touches && 0 < c.originalEvent.touches.length) {
                            var e = eb.platform.touchdevice && "undefined" !== typeof c.originalEvent.touches ? c.originalEvent.touches[0].pageX : c.pageX,
                                g = eb.platform.touchdevice && "undefined" !== typeof c.originalEvent.touches ? c.originalEvent.touches[0].pageY : c.pageY;
                            d.Pc + 20 > e && d.Pc - 20 < e && d.Qc + 20 > g && d.Qc - 20 < g && (hoverPage = parseInt(c.target.id.substring(c.target.id.indexOf("_") + 1)), hoverPageObject = T(d.ja), null != hoverPageObject && (null != d.pages.jScrollPane && d.pages.jScrollPane.data("jsp").disable(), window.Db = !0, d.Fe(!0), window.b = hoverPageObject.match({
                                left: e,
                                top: g
                            }, !1), window.a = hoverPageObject.match({
                                left: e - 1,
                                top: g - 1
                            }, !1), d.be = hoverPageObject.bf(!0, d.ue)));
                        }
                    }, 800));
                    if (d.Fc || eb.platform.touchdevice) {
                        if (!hoverPageObject) {
                            if (eb.platform.touchdevice) {
                                if (c.target && c.target.id && 0 <= c.target.id.indexOf("page") && 0 <= c.target.id.indexOf("word") && (hoverPage = parseInt(c.target.id.substring(c.target.id.indexOf("_") + 1)), hoverPageObject = T(d.ja)), !hoverPageObject) {
                                    window.a = null;
                                    return;
                                }
                            } else {
                                window.a = null;
                                return;
                            }
                        }
                        d.ba == d.na() && 1 < d.scale ? window.a = hoverPageObject.Uk(c.target.id) : window.a = hoverPageObject.match({
                            left: e,
                            top: g
                        }, !0);
                        if (window.a) {
                            return window.Db = !0, d.Fe(), d.be = hoverPageObject.bf(!1, d.ue), !1;
                        }
                        jQuery(c.target).hasClass("flowpaper_tblabelbutton") || jQuery(c.target).hasClass("flowpaper_tbtextbutton") || jQuery(c.target).hasClass("flowpaper_colorselector") || jQuery(c.target).hasClass("flowpaper_tbbutton") || eb.platform.touchdevice || (d.Fe(), d.be = hoverPageObject.bf(!1, d.ue));
                        window.Db = !1;
                        return !0;
                    }
                    window.a = hoverPageObject ? hoverPageObject.match({
                        left: e,
                        top: g
                    }, !0) : null;
                }
            }
        },
        ge: function() {
            this.width || (this.width = this.ka.width());
            return this.width;
        },
        bm: function() {
            return null != this.pages ? this.ba != this.na() ? this.pages.la + 1 : this.pages.la : 1;
        },
        bindEvents: function() {
            var c = this;
            hoverPage = 0;
            hoverPageObject = null;
            c.ka.bind("mousemove", function(d) {
                return c.cn(d);
            });
            c.ka.bind("mousedown", function(d) {
                return c.bn(d);
            });
            c.ka.bind("mouseup", function(d) {
                return c.dn(d);
            });
            var d = jQuery._data(jQuery(window)[0], "events");
            eb.platform.android ? jQuery(window).bind("orientationchange", function(d) {
                c.Ej(d);
            }) : jQuery(window).bind("resize", function(d) {
                c.Ej(d);
            });
            jQuery(window).bind("orientationchange", function(d) {
                c.ho(d);
            });
            d && d.resize && (c.ml = d.resize[d.resize.length - 1]);
            if (!c.document.DisableOverflow) {
                try {
                    jQuery.get(c.config.localeDirectory + c.document.localeChain + "/FlowPaper.txt", function(d) {
                        c.toolbar.Sk(d);
                        c.sj();
                    }).error(function() {
                        c.sj();
                        O("Failed loading supplied locale (" + c.document.localeChain + ")");
                    }), c.toolbar.Sk("");
                } catch (e) {}
            }
            c.dg || (c.dg = "");
        },
        ho: function(c) {
            var d = this;
            d.$h = !0;
            if (window.zine && d.ba == d.na()) {
                switch (window.orientation) {
                    case -90:
                    case 90:
                        d.ca.Ta = "Flip-SinglePage" != d.config.document.TouchInitViewMode ? !1 : !0;
                        break;
                    default:
                        d.ca.Ta = !0;
                }
                d.ca.wb = d.ca.ai();
                setTimeout(function() {
                    d.ba = "";
                    d.switchMode(d.na(), d.getCurrPage() - 1);
                    d.$h = !1;
                    window.scrollTo(0, 0);
                }, 500);
            }
            if ("Portrait" == d.ba || "SinglePage" == d.ba) {
                d.config.document.FitPageOnLoad && d.fitheight(), d.config.document.FitWidthOnLoad && d.fitwidth(), d.ka.height("auto"), setTimeout(function() {
                    requestAnim(function() {
                        d.Ej(c);
                        d.ka.height("auto");
                        d.$h = !1;
                    });
                }, 1000);
            }
        },
        Ej: function(c) {
            if (!this.document.DisableOverflow && !this.$h && !jQuery(c.target).hasClass("flowpaper_note")) {
                c = this.ka.width();
                var d = this.ka.height(),
                    e = !1,
                    g = -1;
                this.kj ? g = this.kj : 0 < this.ka[0].style.width.indexOf("%") && (this.kj = g = parseFloat(this.ka[0].style.width.substr(0, this.ka[0].style.width.length - 1) / 100));
                0 < g && (c = 0 == this.ka.parent().width() ? jQuery(document).width() * g : this.ka.parent().width() * g, e = !0);
                g = -1;
                this.jj ? g = this.jj : 0 < this.ka[0].style.height.indexOf("%") && (this.jj = g = parseFloat(this.ka[0].style.height.substr(0, this.ka[0].style.height.length - 1) / 100));
                0 < g && (d = 0 == this.ka.parent().height() ? jQuery(window).height() * g : this.ka.parent().height() * g, e = !0);
                g = document.Db || document.mozFullScreen || document.webkitIsFullScreen || window.gn || window.Jh;
                e && !g && this.resize(c, d);
            }
        },
        sj: function() {
            var c = this;
            if (!c.document.DisableOverflow) {
                if (c.Oe || (c.Oe = null != c.toolbar && null != c.toolbar.fb ? c.toolbar.Ga(c.toolbar.fb, "LoadingPublication") : "Loading Publication"), null == c.Oe && (c.Oe = "Loading Publication"), c.Ql = window.zine && (c.renderer.config.pageThumbImagePattern && 0 < c.renderer.config.pageThumbImagePattern.length || c.config.document.LoaderImage), c.Ql) {
                    var d = new Image;
                    jQuery(d).bind("load", function() {
                        if (!c.initialized && (!c.hb || c.hb && !c.hb.jquery)) {
                            var d = this.width / 1.5,
                                g = this.height / 1.5;
                            this.width = d;
                            this.height = g;
                            110 < d && (g = this.width / this.height, d = 110, g = d / g);
                            c.hb = jQuery(String.format("<div class='flowpaper_loader' style='position:{1};margin: 0px auto;z-index:100;top:{9};left:{2};color:#ffffff;'><div style='position:relative;'><div class='flowpaper_titleloader_image' style='position:absolute;left:0px;'></div><div class='flowpaper_titleloader_progress' style='position:absolute;left:{7}px;width:{8}px;height:{6}px;background-color:#000000;opacity:0.3;'></div></div></div>", c.ja, "static" == c.ka.css("position") ? "relative" : "absolute", c.ca.Ta && !c.gf ? "35%" : "47%", c.ca.ec, c.renderer.za(1, 200), d, g, 0, d, c.ca.Ta && !c.gf ? "30%" : "40%"));
                            c.ka.append(c.hb);
                            jQuery(this).css({
                                width: d + "px",
                                height: g + "px"
                            });
                            c.hb.find(".flowpaper_titleloader_image").append(this);
                        }
                    });
                    c.config.document.LoaderImage ? d.src = c.config.document.LoaderImage : d.src = c.renderer.za(1, 200);
                } else {
                    !window.zine || eb.browser.msie && 10 > eb.browser.version ? (c.hb = jQuery(String.format("<div class='flowpaper_loader flowpaper_initloader' style='position:{2};z-index:100;'><div class='flowpaper_initloader_panel' style='{1};background-color:#ffffff;'><img src='{0}' style='vertical-align:middle;margin-top:7px;margin-left:5px;'><div style='float:right;margin-right:25px;margin-top:19px;' class='flowpaper_notifylabel'>" + c.Oe + "<br/><div style='margin-left:30px;' class='flowpaper_notifystatus'>" + c.dg + "</div></div></div></div>", c.vm, "margin: 0px auto;", "static" == c.ka.css("position") ? "relative" : "absolute")), c.ka.append(c.hb)) : (c.hb = jQuery(String.format("<div id='flowpaper_initloader_{0}' class='flowpaper_loader flowpaper_initloader' style='position:{1};margin: 0px auto;z-index:100;top:40%;left:{2}'></div>", c.ja, "static" == c.ka.css("position") ? "relative" : "absolute", eb.platform.iphone ? "40%" : "50%")), c.ka.append(c.hb), c.yc = new CanvasLoader("flowpaper_initloader_" + c.ja), c.yc.setColor("#555555"), c.yc.setShape("square"), c.yc.setDiameter(70), c.yc.setDensity(151), c.yc.setRange(0.8), c.yc.setSpeed(2), c.yc.setFPS(42), c.yc.show());
                }
            }
        },
        initialize: function() {
            var c = this;
            FLOWPAPER.Ek.init();
            c.Mo();
            c.Ii = location.hash && 0 <= location.hash.substr(1).indexOf("inpublisher") ? !0 : !1;
            c.ia = jQuery("#" + c.ja);
            c.toolbar = new ia(this, this.document);
            c.Lk = c.document.ImprovedAccessibility;
            !eb.platform.iphone || c.config.document.InitViewMode || window.zine || (c.Gb = "Portrait");
            "BookView" == c.config.document.InitViewMode && 0 == c.document.StartAtPage % 2 && (c.document.StartAtPage += 1);
            c.config.document.TouchInitViewMode && c.config.document.TouchInitViewMode != c.Gb && eb.platform.touchonlydevice && (c.Gb = c.config.document.TouchInitViewMode);
            c.config.document.TouchInitViewMode || !eb.platform.touchonlydevice || window.zine || (c.Gb = "SinglePage");
            window.zine && !c.document.DisableOverflow ? (c.ca = c.toolbar.ji = new FlowPaperViewer_Zine(c.toolbar, this, c.ia), "Portrait" != c.Gb && "Portrait" != c.config.document.TouchInitViewMode || !eb.platform.touchonlydevice || (c.config.document.TouchInitViewMode = c.config.document.InitViewMode = c.ba = "Flip-SinglePage"), c.ca.initialize(), c.ba != c.na() && (c.ba = c.Gb)) : c.ba = c.Gb;
            "CADView" == c.ba && (c.ba = "SinglePage");
            window.zine && (eb.browser.msie && 9 > eb.browser.version || eb.browser.safari && 5 > eb.browser.Hb) && !eb.platform.touchonlydevice && (c.document.MinZoomSize = c.MinZoomSize = 0.3, c.ba = "BookView");
            "0px" == c.ia.css("width") && c.ia.css("width", "1024px");
            "0px" == c.ia.css("height") && c.ia.css("height", "600px");
            c.$d = c.ba == c.na() && (eb.platform.iphone || eb.platform.Ib);
            null !== c.ka || c.ca || (0 < c.ia[0].style.width.indexOf("%") && (c.kj = parseFloat(c.ia[0].style.width.substr(0, c.ia[0].style.width.length - 1) / 100)), 0 < c.ia[0].style.height.indexOf("%") && (c.jj = parseFloat(c.ia[0].style.height.substr(0, c.ia[0].style.height.length - 1) / 100)), c.document.DisableOverflow ? (c.config.document.FitPageOnLoad = !1, c.config.document.FitWidthOnLoad = !0, c.ka = jQuery("<div style='width:210mm;height:297mm;position:relative;left:0px;top:0px;' class='flowpaper_viewer_container'/>")) : (c.ka = jQuery("<div style='" + c.ia.attr("style") + ";' class='flowpaper_viewer_wrap flowpaper_viewer_container'/>"), "" != c.ka.css("position") && "static" != c.ka.css("position") || c.ka.css({
                position: "relative"
            })), c.ka = c.ia.wrap(c.ka).parent(), c.document.DisableOverflow ? c.ia.css({
                left: "0px",
                top: "0px",
                position: "relative",
                width: "210mm",
                height: "297mm"
            }).addClass("flowpaper_viewer") : c.ia.css({
                left: "0px",
                top: "0px",
                position: "relative",
                width: "100%",
                height: "100%"
            }).addClass("flowpaper_viewer").addClass("flowpaper_viewer_gradient"), window.annotations && c.config.document.AnnotationToolsVisible && !c.document.DisableOverflow ? (c.Of = eb.platform.touchdevice ? 15 : 22, c.ia.height(c.ia.height() - c.Of)) : c.Of = 0);
            c.Lp = c.ka.html();
            eb.browser.msie && jQuery(".flowpaper_initloader_panel").css("left", c.ia.width() - 500);
            c.document.DisableOverflow || (null == c.config.Toolbar && 0 == jQuery("#" + c.Ya).length ? (c.Toolbar = c.ka.prepend("<div id='" + c.Ya + "' class='flowpaper_toolbarstd' style='z-index:200;overflow-y:hidden;overflow-x:hidden;'></div>").parent(), c.toolbar.create(c.Ya)) : null == c.config.Toolbar || c.Toolbar instanceof jQuery || (c.config.Toolbar = unescape(c.config.Toolbar), c.Toolbar = jQuery(c.config.Toolbar), c.Toolbar.attr("id", c.Ya), c.ka.prepend(c.Toolbar)));
            c.Uj();
            c.document.DisableOverflow || c.resources.initialize();
            hoverPage = 0;
            hoverPageObject = null;
            null != c.ca ? c.ca.Wm(c.Ya) : window.annotations && (c.plugin = new FlowPaperViewerAnnotations_Plugin(this, this.document, c.Ya + "_annotations"), c.plugin.create(c.Ya + "_annotations"), c.plugin.bindEvents(c.aa));
            c.document.DisableOverflow || (eb.platform.touchdevice || c.ka.append("<textarea id='selector' class='flowpaper_selector' rows='0' cols='0'></textarea>"), 0 == jQuery("#printFrame_" + c.ja).length && c.ka.append("<iframe id='printFrame_" + c.ja + "' name='printFrame_" + c.ja + "' class='flowpaper_printFrame'>"));
            jQuery(c.renderer).bind("loadingProgress", function(d, e) {
                c.Qo(d, e);
            });
            jQuery(c.renderer).bind("labelsLoaded", function(d, e) {
                c.Oo(d, e);
            });
            jQuery(c.renderer).bind("loadingProgressStatusChanged", function(d, e) {
                c.Ro(d, e);
            });
            jQuery(c.renderer).bind("UIBlockingRenderingOperation", function(d, e) {
                c.vd(d, e);
            });
            jQuery(c.renderer).bind("UIBlockingRenderingOperationCompleted", function() {
                c.oc();
            });
            $FlowPaper(c.ja).dispose = c.dispose;
            $FlowPaper(c.ja).highlight = c.highlight;
            $FlowPaper(c.ja).getCurrentRenderingMode = c.getCurrentRenderingMode;
        },
        Uj: function() {
            this.Dm || this.document.DisableOverflow || (eb.platform.touchonlydevice && !this.$d ? eb.platform.touchonlydevice ? (window.zine ? this.ia.height(this.ia.height() - (this.config.BottomToolbar ? 65 : 35)) : this.ia.height(this.ia.height() - (this.config.BottomToolbar ? 65 : 25)), this.config.BottomToolbar && this.ka.height(this.ka.height() - (eb.platform.Ib ? 7 : 18))) : this.ia.height(this.ia.height() - 25) : window.zine || (this.config.BottomToolbar ? this.ia.height(this.ia.height() - jQuery(this.ea).height() + 11) : this.ia.height(this.ia.height() - 13)), this.Dm = !0);
        },
        Oo: function(c, d) {
            if (window.zine && this.ca && this.ca.Jc) {
                var e = this.ca.Jc.createElement("labels");
                this.ca.Jc.childNodes[0].appendChild(e);
                try {
                    for (var g = 0; g < d.Ok.length; g++) {
                        var f = d.Ok[g],
                            l = e,
                            k = this.ca.Jc.createElement("node");
                        k.setAttribute("pageNumber", g + 1);
                        k.setAttribute("title", escape(f));
                        l.appendChild(k);
                    }
                } catch (m) {}
                this.labels = jQuery(e);
            }
        },
        Qo: function(c, d) {
            this.dg = Math.round(100 * d.progress) + "%";
            this.hb && this.hb.find && 0 < this.hb.find(".flowpaper_notifystatus").length && this.hb.find(".flowpaper_notifystatus").html(this.dg);
            if (this.Ql && this.hb && this.hb.find) {
                var e = this.hb.find(".flowpaper_titleloader_progress");
                if (e) {
                    var g = this.hb.find(".flowpaper_titleloader_image");
                    if (0 < g.length) {
                        var f = g.css("width"),
                            f = parseFloat(f.replace("px", ""));
                        requestAnim(function() {
                            e.animate({
                                left: f * d.progress + "px",
                                width: f * (1 - d.progress) + "px"
                            }, 100);
                        });
                    }
                }
            }
        },
        Ro: function(c, d) {
            this.Oe = d.label;
            this.hb.find(".flowpaper_notifylabel").html(d.label);
        },
        vd: function(c, d) {
            var e = this;
            e.document.DisableOverflow || null !== e.ad || (e.ad = jQuery("<div style='position:absolute;left:50%;top:50%;'></div>"), e.ka.append(e.ad), e.ad.spin({
                color: "#777"
            }), null != e.Xg && (window.clearTimeout(e.Xg), e.Xg = null), d.po || (e.Xg = setTimeout(function() {
                e.ad && (e.ad.remove(), e.ad = null);
            }, 1000)));
        },
        oc: function() {
            this.ad && (this.ad.remove(), this.ad = null);
        },
        show: function() {
            var c = this;
            jQuery(c.resources).bind("onPostinitialized", function() {
                setTimeout(function() {
                    c.kg();
                    c.document.DisableOverflow || c.toolbar.bindEvents(c.ia);
                    null == c.ca || c.document.DisableOverflow || c.ca.bindEvents(c.ia);
                    c.ca.Jj ? (c.Hh(c.document.StartAtPage), jQuery(c.ia).trigger("onDocumentLoaded", c.renderer.getNumPages())) : c.Gg = function() {
                        c.Hh(c.document.StartAtPage);
                        jQuery(c.ia).trigger("onDocumentLoaded", c.renderer.getNumPages());
                    };
                }, 50);
                jQuery(c.resources).unbind("onPostinitialized");
            });
            c.resources.qo();
        },
        dispose: function() {
            this.$m = !0;
            this.ia.unbind();
            this.ia.find("*").unbind();
            this.ka.find("*").unbind();
            this.ka.find("*").remove();
            this.ia.empty();
            this.ka.empty();
            jQuery(this).unbind();
            0 == jQuery(".flowpaper_viewer_container").length && window.PDFJS && delete window.PDFJS;
            this.plugin && (jQuery(this.plugin).unbind(), this.plugin.dispose(), delete this.plugin, this.plugin = null);
            jQuery(this.renderer).unbind();
            this.renderer.dispose();
            delete this.renderer;
            delete this.config;
            jQuery(this.pages).unbind();
            this.pages.dispose();
            delete this.pages;
            delete window["wordPageList_" + this.ja];
            window["wordPageList_" + this.ja] = null;
            this.ka.unbind("mousemove");
            this.ka.unbind("mousedown");
            this.ka.unbind("mouseup");
            jQuery(window).unbind("resize", this.ml);
            delete this.ml;
            jQuery(this.renderer).unbind("loadingProgress");
            jQuery(this.renderer).unbind("labelsLoaded");
            jQuery(this.renderer).unbind("loadingProgressStatusChanged");
            jQuery(this.renderer).unbind("UIBlockingRenderingOperation");
            jQuery(this.renderer).unbind("UIBlockingRenderingOperationCompleted");
            this.ca ? this.ca.dispose() : this.ia.parent().remove();
            var c = this.ka.parent(),
                d = this.ka.attr("style");
            this.ka.remove();
            delete this.ka;
            delete this.ia;
            this.renderer && (delete this.renderer.Wa, delete this.renderer.oa, delete this.renderer.Ua, delete this.renderer.rh, delete this.renderer.mb);
            delete this.renderer;
            var e = jQuery(this.Lp);
            e.attr("style", d);
            e.attr("class", "flowpaper_viewer");
            c.append(e);
            this.plugin && delete this.plugin;
        },
        kh: function() {
            var c = this;
            eb.platform.touchonlydevice ? (c.initialized = !0, (!c.ca && c.config.document.FitWidthOnLoad && "TwoPage" != c.ba && "BookView" != c.ba || "Portrait" == c.ba || "SinglePage" == c.ba) && c.fitwidth(), (c.config.document.FitPageOnLoad || "TwoPage" == c.ba || "BookView" == c.ba || c.ca) && c.fitheight(), c.pages.sg(), c.pages.ne()) : (c.initialized = !0, c.Gq || c.toolbar.Am(c.config.document.MinZoomSize, c.config.document.MaxZoomSize), c.config.document.FitPageOnLoad || "TwoPage" == c.ba || "BookView" == c.ba ? c.fitheight() : c.config.document.FitWidthOnLoad && "TwoPage" != c.ba && "BookView" != c.ba ? c.fitwidth() : c.Zoom(c.config.document.Scale));
            c.document.StartAtPage && 1 != c.document.StartAtPage || c.ba == c.na() || c.ia.trigger("onCurrentPageChanged", c.pages.la + 1);
            c.document.StartAtPage && 1 != c.document.StartAtPage && c.pages.scrollTo(c.document.StartAtPage);
            c.ca && c.ca.kh();
            c.hb && c.hb.fadeOut ? c.hb.fadeOut(300, function() {
                c.hb && (c.hb.remove(), c.ka.find(".flowpaper_loader").remove(), c.yc && (c.yc.kill(), delete c.yc), delete c.hb, c.yc = null, jQuery(c.pages.da).fadeIn(300, function() {}), c.PreviewMode && c.ca.pb.Ih(c.pages, c.ia));
            }) : (c.ka.find(".flowpaper_loader").remove(), jQuery(c.pages.da).fadeIn(300, function() {}), c.PreviewMode && c.ca.pb.Ih(c.pages, c.ia));
            c.ia.trigger("onInitializationComplete");
        },
        kg: function() {
            this.renderer.li = !1;
            if (this.pages) {
                for (var c = 0; c < this.document.numPages; c++) {
                    this.pages.pages[c] && window.clearTimeout(this.pages.pages[c].gc);
                }
            }
            this.ua = 1;
            this.ia.find("*").unbind();
            this.ia.find("*").remove();
            this.ia.empty();
            this.renderer.qf = !1;
            jQuery(this.Cj).remove();
            this.ca && this.ca.kg();
        },
        Hh: function(c) {
            this.pages = new V(this.ia, this, this.ja, c);
            this.pages.create(this.ia);
        },
        previous: function() {
            var c = this;
            c.aj || c.ba == c.na() ? c.ba == c.na() && c.pages.previous() : (c.aj = setTimeout(function() {
                window.clearTimeout(c.aj);
                c.aj = null;
            }, 700), c.pages.previous());
        },
        hn: function() {
            var c = this;
            c.cb && c.rf();
            if (!c.Kb && c.outline && (!c.outline || 0 != c.outline.length)) {
                c.Ca = c.ia.width();
                c.Na = c.ia.height();
                var d = c.Oe = null != c.toolbar && null != c.toolbar.fb ? c.toolbar.Ga(c.toolbar.fb, "TOC", "Table of Contents") : "Table of Contents",
                    e = c.ba == c.na() ? jQuery(c.ea).css("background-color") : "#c8c8c8",
                    g = c.ba == c.na() ? "40px" : jQuery(c.ea).height() + 2;
                c.na();
                var f = c.ba == c.na() ? 30 : 40,
                    l = c.ba == c.na() ? 0 : 41,
                    k = c.ca && !c.ca.vh ? jQuery(c.ea).offset().top + jQuery(c.ea).outerHeight() : 0,
                    m = c.ia.height() - (null != c.Ye ? c.Ye.height() + 20 : 0) - k;
                c.og = c.ka.find(c.ea).css("margin-left");
                "rgba(0, 0, 0, 0)" == e.toString() && (e = "#555");
                c.ka.append(jQuery(String.format("<div class='flowpaper_toc' style='position:absolute;left:0px;top:{8}px;height:{5}px;width:{2};min-width:{3};opacity: 0;z-index:13;'><div style='margin: 20px 20px 20px 20px;padding: 10px 10px 10px 10px;background-color:{6};height:{7}px'><div style='height:25px;width:100%'><div class='flowpaper_tblabel' style='margin-left:10px; width: 100%;height:25px;'><img src='{1}' style='vertical-align: middle;width:14px;height:auto;'><span style='margin-left:10px;vertical-align: middle'>{0}</span><img src='{4}' style='float:right;margin-right:5px;cursor:pointer;' class='flowpaper_toc_close' /></div><hr size='1' color='#ffffff' /></div></div>", d, c.wm, "20%", "250px", c.Fh, m, e, m - 20, k)));
                c.Kb = c.ka.find(".flowpaper_toc");
                jQuery(c.Kb.children()[0]).css({
                    "border-radius": "3px",
                    "-moz-border-radius": "3px"
                });
                jQuery(c.Kb.children()[0]).append("<div class='flowpaper_toc_content' style='display:block;position:relative;height:" + (jQuery(c.Kb.children()[0]).height() - f) + "px;margin-bottom:50px;width:100%;overflow-y: auto;overflow-x: hidden;'><ul class='flowpaper_accordionSkinClear'>" + da(c, c.outline.children()).html() + "</ul></div>");
                d = jQuery(".flowpaper_accordionSkinClear").children();
                0 < d.children().length && (d = jQuery(d.get(0)).children(), 0 < d.children().length && jQuery(d.find("li").get(0)).addClass("cur"));
                c.resize(c.ia.width() - c.Kb.width(), c.ia.height() + l, !1, function() {});
                jQuery(".flowpaper_accordionSkinClear").Sn();
                jQuery(".flowpaper-tocitem").bind("mousedown", function() {
                    c.gotoPage(jQuery(this).data("pagenumber"));
                });
                c.ia.animate({
                    left: c.Kb.width() + "px"
                }, 0);
                l = 0.5 * c.Kb.width();
                jQuery(c.ea).width() + l > c.ka.width() && (l = 0);
                jQuery(c.ea).animate({
                    "margin-left": parseFloat(c.og) + l + "px"
                }, 200, function() {
                    if (window.onresize) {
                        window.onresize();
                    }
                });
                0 == l && c.Kb.css({
                    top: g,
                    height: c.ia.height() - 40 + "px"
                });
                c.ba == c.na() && c.ca.Wo();
                c.Kb.fadeTo("fast", 1);
                c.ka.find(".flowpaper_toc_close").bind("mousedown", function() {
                    c.Jk();
                });
            }
        },
        Jk: function() {
            var c = this;
            c.Kb.hide();
            c.ka.find(".flowpaper_tocitem, .flowpaper_tocitem_separator").remove();
            c.resize(c.Ca, c.Na + 33, !1);
            c.ia.css({
                left: "0px"
            });
            jQuery(c.ea).animate({
                "margin-left": parseFloat(c.og) + "px"
            }, 200);
            c.ba == c.na() && c.ca.rf();
            c.Kb.fadeTo("fast", 0, function() {
                c.Kb.remove();
                c.Kb = null;
            });
        },
        setCurrentCursor: function(c) {
            "ArrowCursor" == c && (this.Fc = !1, addCSSRule(".flowpaper_pageword", "cursor", "default"), window.annotations || jQuery(".flowpaper_pageword_" + this.ja).remove());
            "TextSelectorCursor" == c && (this.Fc = !0, this.ue = "flowpaper_selected_default", addCSSRule(".flowpaper_pageword", "cursor", "text"), window.annotations || (this.pages.getPage(this.pages.la - 1), this.pages.getPage(this.pages.la - 2), this.pages.La()));
            this.ca && this.ca.setCurrentCursor(c);
            this.pages.setCurrentCursor(c);
            jQuery(this.ea).trigger("onCursorChanged", c);
        },
        highlight: function(c) {
            var d = this;
            jQuery.ajax({
                type: "GET",
                url: c,
                dataType: "xml",
                error: function() {},
                success: function(c) {
                    jQuery(c).find("Body").attr("color");
                    c = jQuery(c).find("Highlight");
                    var g = 0,
                        f = -1,
                        l = -1;
                    jQuery(c).find("loc").each(function() {
                        g = parseInt(jQuery(this).attr("pg"));
                        f = parseInt(jQuery(this).attr("pos"));
                        l = parseInt(jQuery(this).attr("len"));
                        d.pages.getPage(g).Ce(f, l, !1);
                    });
                    d.pages.La();
                }
            });
        },
        printPaper: function(c) {
            if (eb.platform.touchonlydevice) {
                c = "current";
            } else {
                if (!c) {
                    jQuery("#modal-print").css("background-color", "#dedede");
                    jQuery("#modal-print").smodal({
                        minHeight: 255,
                        appendTo: this.ka
                    });
                    jQuery("#modal-print").parent().css("background-color", "#dedede");
                    return;
                }
            }
            "current" == c && 0 < jQuery(this.ea).find(".flowpaper_txtPageNumber").val().indexOf("-") && (c = jQuery(this.ea).find(".flowpaper_txtPageNumber").val());
            var d = null,
                e = "ImagePageRenderer";
            if ("ImagePageRenderer" == this.renderer.lf() || this.document.MixedMode || this.renderer.config.pageImagePattern && this.renderer.config.jsonfile) {
                e = "ImagePageRenderer", d = "{key : '" + this.config.key + "',jsonfile : '" + this.renderer.config.jsonfile + "',compressedJsonFormat : " + (this.renderer.Sa ? this.renderer.Sa : !1) + ",pageImagePattern : '" + this.renderer.config.pageImagePattern + "',JSONDataType : '" + this.renderer.config.JSONDataType + "',signature : '" + this.renderer.config.signature + "',UserCollaboration : " + this.config.UserCollaboration + "}";
            }
            "CanvasPageRenderer" == this.renderer.lf() && (e = "CanvasPageRenderer", d = "{key : '" + this.config.key + "',jsonfile : '" + this.renderer.config.jsonfile + "',PdfFile : '" + this.renderer.file + "',compressedJsonFormat : " + (this.renderer.Sa ? this.renderer.Sa : !1) + ",pageThumbImagePattern : '" + this.renderer.config.pageThumbImagePattern + "',pageImagePattern : '" + this.renderer.config.pageImagePattern + "',JSONDataType : '" + this.renderer.config.JSONDataType + "',signature : '" + this.renderer.config.signature + "',UserCollaboration : " + this.config.UserCollaboration + "}");
            if (0 < jQuery("#printFrame_" + this.ja).length) {
                var g = window.printFrame = eb.browser.msie ? window.open().document : jQuery("#printFrame_" + this.ja)[0].contentWindow.document || jQuery("#printFrame_" + this.ja)[0].contentDocument,
                    f = "",
                    l = this.renderer.getDimensions()[0].width,
                    k = this.renderer.getDimensions()[0].height;
                g.open();
                f += "<html><head>";
                f += "<script type='text/javascript' src='" + this.config.jsDirectory + "jquery.min.js'>\x3c/script>";
                f += "<script type='text/javascript' src='" + this.config.jsDirectory + "jquery.extensions.min.js'>\x3c/script>";
                f += '<script type="text/javascript" src="' + this.config.jsDirectory + 'flowpaper.js">\x3c/script>';
                f += '<script type="text/javascript" src="' + this.config.jsDirectory + 'flowpaper_handlers.js">\x3c/script>';
                f += "<script type='text/javascript' src='" + this.config.jsDirectory + "FlowPaperViewer.js'>\x3c/script>";
                f += "<script type='text/javascript'>window.printWidth = '" + l + "pt';window.printHeight = '" + k + "pt';\x3c/script>";
                f += "<style type='text/css' media='print'>html, body { height:100%; } body { margin:0; padding:0; } .flowpaper_ppage { clear:both;display:block;max-width:" + l + "pt;max-height:" + k + "pt;margin-top:0px;} .ppage_break { page-break-after : always; } .ppage_none { page-break-after : avoid; }</style>";
                f += "<style type='text/css' media='print'>@supports ((size:A4) and (size:1pt 1pt)) {@page { margin: 0mm 0mm 0mm 0mm; size: " + l + "pt " + k + "pt;}}</style>";
                f += "<link rel='stylesheet' type='text/css' href='" + this.config.cssDirectory + "flowpaper.css' />";
                f += "</head>";
                f += "<body>";
                f += '<script type="text/javascript">';
                f += "function waitForLoad(){";
                f += "if(window.jQuery && window.$FlowPaper && window.print_flowpaper_Document ){";
                f += "window.focus();";
                f += "window.print_flowpaper_Document('" + e + "'," + d + ",'" + c + "', " + this.bm() + ", " + this.getTotalPages() + ", '" + this.config.jsDirectory + "');";
                f += "}else{setTimeout(function(){waitForLoad();},1000);}";
                f += "}";
                f += "waitForLoad();";
                f += "\x3c/script>";
                f += "</body></html>";
                g.write(f);
                eb.browser.msie || setTimeout("window['printFrame'].close();", 3000);
                eb.browser.msie && 9 <= eb.browser.version && g.close();
            }
        },
        switchMode: function(c, d) {
            var e = this;
            e.ba == c || ("TwoPage" == c || "BookView" == c) && 2 > e.getTotalPages() || (d > e.getTotalPages() && (d = e.getTotalPages()), e.cb && e.rf(), jQuery(e.pages.da).jn(function() {
                e.ca && e.ca.switchMode(c, d);
                "Tile" == c && (e.ba = "ThumbView");
                "Portrait" == c && (e.ba = "SinglePage" == e.Gb ? "SinglePage" : "Portrait");
                "SinglePage" == c && (e.ba = "SinglePage");
                "TwoPage" == c && (e.ba = "TwoPage");
                "BookView" == c && (e.ba = "BookView");
                e.kg();
                e.pages.Fo();
                e.renderer.Ie = -1;
                e.renderer.Wa && e.renderer.Wa.Ko();
                "TwoPage" != c && "BookView" != c && (null != d ? e.pages.la = d - 1 : d = 1);
                e.Hh(d);
                jQuery(e.ea).trigger("onViewModeChanged", c);
                setTimeout(function() {
                    !eb.platform.touchdevice || eb.platform.touchdevice && ("SinglePage" == c || "Portrait" == c) ? e.fitheight() : "TwoPage" != c && "BookView" != c && c != e.na() && e.fitwidth();
                    "TwoPage" != c && "BookView" != c && e.dd(d);
                }, 100);
            }));
        },
        fitwidth: function() {
            if ("TwoPage" != this.ba && "BookView" != this.ba && "ThumbView" != this.ba) {
                var c = jQuery(this.pages.da).width() - (this.document.DisableOverflow ? 0 : 15),
                    d = 1 < this.getTotalPages() ? this.ua - 1 : 0;
                0 > d && (d = 0);
                this.document.DisplayRange && (d = parseInt(this.document.DisplayRange.split("-")[0]) - 1);
                var e = this.pages.getPage(d).dimensions.Ca / this.pages.getPage(d).dimensions.Na;
                if (eb.platform.touchdevice) {
                    c = c / (this.pages.getPage(d).ab * e) - (this.document.DisableOverflow ? 0 : 0.03), window.FitWidthScale = c, this.lb(c), this.pages.vj();
                } else {
                    c = c / (this.pages.getPage(d).ab * this.document.MaxZoomSize * e) - (this.document.DisableOverflow ? 0 : 0.012);
                    if (90 == this.pages.getPage(d).rotation || 270 == this.pages.getPage(d).rotation) {
                        c = this.Me();
                    }
                    window.FitWidthScale = c;
                    jQuery(this.ea).trigger("onScaleChanged", c / this.document.MaxZoomSize);
                    c * this.document.MaxZoomSize >= this.document.MinZoomSize && c <= this.document.MaxZoomSize && ("Portrait" == this.ba ? this.lb(this.document.MaxZoomSize * c, {
                        Ig: !0
                    }) : this.lb(this.document.MaxZoomSize * c));
                }
            }
        },
        getCurrentRenderingMode: function() {
            return this.renderer instanceof CanvasPageRenderer ? "html5" : "html";
        },
        lb: function(c, d) {
            var e = this;
            if (e.initialized && e.pages) {
                if (!d || d && !d.Ig) {
                    var f = 100 / (100 * e.document.ZoomInterval);
                    c = Math.round(c * f) / f;
                }
                e.ba == e.na() && 1 > c && (c = 1);
                jQuery(e.ea).trigger("onScaleChanged", c / e.document.MaxZoomSize);
                var f = jQuery(e.pages.da).prop("scrollHeight"),
                    h = jQuery(e.pages.da).scrollTop(),
                    f = 0 < h ? h / f : 0;
                null != e.Xe && (window.clearTimeout(e.Xe), e.Xe = null);
                e.pages.Co() && e.scale != c && (jQuery(".flowpaper_annotation_" + e.ja).remove(), jQuery(".flowpaper_pageword_" + e.ja).remove());
                e.Xe = setTimeout(function() {
                    e.fc();
                    e.pages && e.pages.La();
                }, 500);
                if (0 < c) {
                    c < e.config.document.MinZoomSize && (c = this.config.document.MinZoomSize);
                    c > e.config.document.MaxZoomSize && (c = this.config.document.MaxZoomSize);
                    e.pages.Xa(c, d);
                    e.scale = c;
                    !d || d && !d.Ed ? e.pages.pages[0] && e.pages.pages[0].Ee() : e.pages.Fg(d.jc, d.Ic);
                    jQuery(e.ea).trigger("onZoomFactorChanged", {
                        df: c,
                        aa: e
                    });
                    if ("undefined" != window.FitWidthScale && Math.round(100 * window.FitWidthScale) == Math.round(c / e.document.MaxZoomSize * 100)) {
                        if (jQuery(e.ea).trigger("onFitModeChanged", "FitWidth"), window.onFitModeChanged) {
                            window.onFitModeChanged("Fit Width");
                        }
                    } else {
                        if ("undefined" != window.FitHeightScale && Math.round(100 * window.FitHeightScale) == Math.round(c / e.document.MaxZoomSize * 100)) {
                            if (jQuery(e.ea).trigger("onFitModeChanged", "FitHeight"), window.onFitModeChanged) {
                                window.onFitModeChanged("Fit Height");
                            }
                        } else {
                            if (jQuery(e.ea).trigger("onFitModeChanged", "FitNone"), window.onFitModeChanged) {
                                window.onFitModeChanged("Fit None");
                            }
                        }
                    }
                    e.pages.ne();
                    e.pages.sd();
                    e.pages.vj();
                    h = jQuery(e.pages.da).prop("scrollHeight");
                    eb.browser.rb.Bb && (!d || d && !d.Ed ? jQuery(e.pages.da).scrollTo({
                        left: "50%",
                        top: h * f + "px"
                    }, 0, {
                        axis: "xy"
                    }) : jQuery(e.pages.da).scrollTo({
                        top: h * f + "px"
                    }, 0, {
                        axis: "y"
                    }));
                }
            }
        },
        fc: function() {
            if (this.renderer) {
                null != this.Xe && (window.clearTimeout(this.Xe), this.Xe = null);
                "CanvasPageRenderer" == this.renderer.lf() && jQuery(".flowpaper_pageword_" + this.ja + ":not(.flowpaper_selected_searchmatch)").remove();
                this.pages.Bf && 0 <= this.pages.Bf && this.pages.pages[this.pages.Bf].ib && this.renderer.Pb(this.pages.pages[this.pages.Bf], !0);
                for (var c = 0; c < this.document.numPages; c++) {
                    this.pages.kb(c) && c != this.pages.Bf && this.pages.pages[c] && (this.pages.pages[c].ib ? this.renderer.Pb(this.pages.pages[c], !0) : this.pages.pages[c].Fa = !1);
                }
            }
        },
        Zoom: function(c, d) {
            !eb.platform.touchonlydevice || "TwoPage" != this.ba && "BookView" != this.ba ? (c > this.document.MaxZoomSize && (c = this.document.MaxZoomSize), c = c / this.document.MaxZoomSize, jQuery(this.ea).trigger("onScaleChanged", c), c * this.document.MaxZoomSize >= this.document.MinZoomSize && c <= this.document.MaxZoomSize && this.lb(this.document.MaxZoomSize * c, d)) : 1 < c ? "TwoPage" == this.ba || "BookView" == this.ba ? this.pages.je() : "Portrait" != this.ba && "SinglePage" != this.ba || this.fitwidth() : "TwoPage" == this.ba || "BookView" == this.ba ? this.pages.fd() : "Portrait" != this.ba && "SinglePage" != this.ba || this.fitheight();
        },
        ZoomIn: function() {
            this.Zoom(this.scale + 3 * this.document.ZoomInterval);
        },
        ZoomOut: function() {
            if ("Portrait" == this.ba || "SinglePage" == this.ba) {
                null != this.pages.jScrollPane ? (this.pages.jScrollPane.data("jsp").scrollTo(0, 0, !1), this.pages.jScrollPane.data("jsp").reinitialise(this.Oc)) : this.pages.ga(this.pages.da).parent().scrollTo({
                    left: 0,
                    top: 0
                }, 0, {
                    axis: "xy"
                });
            }
            this.Zoom(this.scale - 3 * this.document.ZoomInterval);
        },
        sliderChange: function(c) {
            c > this.document.MaxZoomSize || (c = c / this.document.MaxZoomSize, c * this.document.MaxZoomSize >= this.document.MinZoomSize && c <= this.document.MaxZoomSize && this.lb(this.document.MaxZoomSize * c));
        },
        tj: function() {
            var c = this;
            if (!eb.platform.mobilepreview && (c.Kb && c.Jk(), !c.cb)) {
                c.ka.find(".flowpaper_searchabstract_result, .flowpaper_searchabstract_result_separator").remove();
                var d = c.Oe = null != c.toolbar && null != c.toolbar.fb ? c.toolbar.Ga(c.toolbar.fb, "Search") : "Search",
                    e = c.ca && !c.ca.vh ? jQuery(c.ea).offset().top + jQuery(c.ea).outerHeight() : 0,
                    f = c.ia.height() - (null != c.Ye ? c.Ye.height() + 20 : 0) - e,
                    h = c.ba == c.na() ? jQuery(c.ea).css("background-color") : "#c8c8c8",
                    l = c.ba == c.na() ? "40px" : jQuery(c.ea).height() + 2,
                    k = c.ba == c.na() ? "color:#ededed" : "color:#555555;",
                    m = (c.na(), 40),
                    n = c.ba == c.na() ? 0 : 41;
                "rgba(0, 0, 0, 0)" == h.toString() && (h = "#555");
                c.og = c.ka.find(c.ea).css("margin-left");
                c.ba == c.na() ? (c.ka.append(jQuery(String.format("<div class='flowpaper_searchabstracts' style='position:absolute;left:0px;top:{8}px;height:{5}px;width:{2};min-width:{3};opacity: 0;z-index:13;'><div style='margin: 20px 20px 20px 20px;padding: 10px 10px 10px 10px;background-color:{6};height:{7}px'><div style='height:25px;width:100%'><div class='flowpaper_tblabel' style='margin-left:10px; width: 100%;height:25px;'><img src='{1}' style='vertical-align: middle'><span style='margin-left:10px;vertical-align: middle'>{0}</span><img src='{4}' style='float:right;margin-right:5px;cursor:pointer;' class='flowpaper_searchabstracts_close' /></div><hr size='1' color='#ffffff' /></div></div>", d, c.Mj, "20%", "250px", c.Fh, f, h, f - 20, e))), c.cb = c.ka.find(".flowpaper_searchabstracts"), jQuery(c.cb.children()[0]).css({
                    "border-radius": "3px",
                    "-moz-border-radius": "3px"
                }), jQuery(c.cb.children()[0]).append("<div class='flowpaper_searchabstracts_content' style='display:block;position:relative;height:" + (jQuery(c.cb.children()[0]).height() - m) + "px;margin-bottom:50px;width:100%;overflow-y: auto;overflow-x: hidden;'></div>"), c.resize(c.ia.width() - c.cb.width(), c.ia.height() + n, !1, function() {}), c.ia.animate({
                    left: c.cb.width() + "px"
                }, 0)) : (c.ka.append(jQuery(String.format("<div class='flowpaper_searchabstracts' style='position:absolute;left:0px;top:0px;height:{5}px;width:{2};min-width:{3};opacity: 0;z-index:13;overflow:hidden;'><div style='margin: 0px 0px 0px 0px;padding: 10px 7px 10px 10px;background-color:{6};height:{7}px'><div style='height:25px;width:100%' <div class='flowpaper_tblabel' style='margin-left:10px; width: 100%;height:25px;'><img src='{1}' style='vertical-align: middle'><span style='margin-left:10px;vertical-align: middle'>{0}</span><img src='{4}' style='float:right;margin-right:5px;cursor:pointer;' class='flowpaper_searchabstracts_close' /></div><div class='flowpaper_bottom_fade'></div></div></div>", d, c.Mj, "20%", "250px", c.Fh, c.ia.height(), h, c.ka.height() - 58))), c.cb = c.ka.find(".flowpaper_searchabstracts"), jQuery(c.cb.children()[0]).append("<div class='flowpaper_searchabstracts_content' style='display:block;position:relative;height:" + f + "px;margin-bottom:50px;width:100%;overflow-y: auto;overflow-x: hidden;'></div>"), "TwoPage" != c.ba && c.resize(c.ia.width() - c.cb.width() / 2, c.ka.height() + 1, !1, function() {}), c.ia.animate({
                    left: c.cb.width() / 2 + "px"
                }, 0), c.fitheight());
                d = 0.5 * c.cb.width();
                jQuery(c.ea).width() + d > c.ka.width() && (d = 0);
                jQuery(c.ea).animate({
                    "margin-left": parseFloat(c.og) + d + "px"
                }, 200, function() {
                    if (window.onresize) {
                        window.onresize();
                    }
                });
                0 == d && c.cb.css({
                    top: l,
                    height: c.ia.height() - 40 + "px"
                });
                c.ba == c.na() && c.ca.tj();
                c.cb.fadeTo("fast", 1);
                var u = c.ka.find(".flowpaper_searchabstracts_content");
                jQuery(c).bind("onSearchAbstractAdded", function(d, e) {
                    var f = e.Be.tn;
                    100 < f.length && (f = f.substr(0, 100) + "...");
                    f = f.replace(new RegExp(c.Pd, "g"), "<font style='color:#ffffff'>[" + c.Pd + "]</font>");
                    f = "<b>p." + (e.Be.pageIndex + 1) + "</b> : " + f;
                    u.append(jQuery(String.format("<div id='flowpaper_searchabstract_item_{1}' style='{2}' class='flowpaper_searchabstract_result'>{0}</div><hr size=1 color='#777777' style='margin-top:8px;' class='flowpaper_searchabstract_result_separator' />", f, e.Be.id, k)));
                    jQuery("#flowpaper_searchabstract_item_" + e.Be.id).bind("mousedown", function(d) {
                        c.gb = e.Be.pageIndex + 1;
                        c.se = e.Be.Io;
                        c.Cc = -1;
                        c.searchText(c.Pd, !1);
                        d.preventDefault && d.preventDefault();
                        d.returnValue = !1;
                    });
                    jQuery("#flowpaper_searchabstract_item_" + e.Be.id).bind("mouseup", function(c) {
                        c.preventDefault && c.preventDefault();
                        c.returnValue = !1;
                    });
                });
                c.ka.find(".flowpaper_searchabstracts_close").bind("mousedown", function() {
                    c.rf();
                });
            }
        },
        rf: function() {
            var c = this;
            c.cb && (c.cb.hide(), c.ka.find(".flowpaper_searchabstract_result, .flowpaper_searchabstract_result_separator").remove(), c.ba == c.na() ? (c.resize(c.ia.width() + c.cb.width(), c.ia.height(), !1), c.ia.css({
                left: "0px"
            })) : "TwoPage" == c.ba ? (c.ia.css({
                left: "0px",
                width: "100%"
            }), c.fitheight()) : (c.resize(c.ia.width() + c.cb.width() / 2, c.ka.height() + 1, !1), c.ia.css({
                left: "0px"
            })), jQuery(c.ea).animate({
                "margin-left": parseFloat(c.og) + "px"
            }, 200), c.ba == c.na() && c.ca.rf(), c.cb.fadeTo("fast", 0, function() {
                c.cb.remove();
                c.cb = null;
            }));
            jQuery(c).unbind("onSearchAbstractAdded");
        },
        Nk: function(c, d) {
            jQuery(".flowpaper_searchabstract_blockspan").remove();
            var e = this.renderer.getNumPages();
            d || (d = 0);
            for (var f = d; f < e; f++) {
                this.ym(f, c);
            }
            this.ba != this.na() && this.ka.find(".flowpaper_searchabstracts_content").append(jQuery("<div class='flowpaper_searchabstract_blockspan' style='display:block;clear:both;height:200px'></div>"));
        },
        ym: function(c, d) {
            var e = this,
                f = e.renderer.mb;
            if (null != f[c]) {
                f[c].toLowerCase().indexOf("actionuri") && (f[c] = f[c].replace("actionURI", ""), f[c] = f[c].replace("):", ")"));
                f[c].toLowerCase().indexOf("actiongotor") && (f[c] = f[c].replace("actionGoToR", ""));
                f[c].toLowerCase().indexOf("actiongoto") && (f[c] = f[c].replace("actionGoTo", ""));
                for (var h = f[c].toLowerCase().indexOf(d), l = 0; 0 < h;) {
                    var k = 0 < h - 50 ? h - 50 : 0,
                        m = h + 75 < f[c].length ? h + 75 : f[c].length,
                        n = e.Bc.length;
                    e.Bc.Re[n] = [];
                    e.Bc.Re[n].pageIndex = c;
                    e.Bc.Re[n].Io = l;
                    e.Bc.Re[n].id = e.ja + "_" + c + "_" + l;
                    e.Bc.Re[n].tn = f[c].substr(k, m - k);
                    h = f[c].toLowerCase().indexOf(d, h + 1);
                    jQuery(e).trigger("onSearchAbstractAdded", {
                        Be: e.Bc.Re[n]
                    });
                    l++;
                }
            } else {
                null == e.sl && (e.sl = setTimeout(function() {
                    null == e.renderer.kd && e.renderer.Rc(c + 1, !1, function() {
                        e.sl = null;
                        e.Nk(d, c);
                    });
                }, 100));
            }
        },
        searchText: function(c, d) {
            var e = this;
            if (null != c && (null == c || 0 != c.length)) {
                if (void 0 !== d || "Portrait" != e.ba && "TwoPage" != e.ba && e.ba != e.na() || !e.document.EnableSearchAbstracts || eb.platform.mobilepreview || (d = !0), d && e.ba == e.na() && 1 < e.scale && (e.renderer.Xc && e.renderer.Dr(), e.Zoom(1)), jQuery(e.ea).find(".flowpaper_txtSearch").val() != c && jQuery(e.ea).find(".flowpaper_txtSearch").val(c), "ThumbView" == e.ba) {
                    e.switchMode("Portrait"), setTimeout(function() {
                        e.searchText(c);
                    }, 1000);
                } else {
                    var f = e.renderer.mb,
                        h = e.renderer.getNumPages();
                    e.nh || (e.nh = 0);
                    if (0 == e.renderer.Wa.Ua.length && 10 > e.nh) {
                        window.clearTimeout(e.Jo), e.Jo = setTimeout(function() {
                            e.searchText(c, d);
                        }, 500), e.nh++;
                    } else {
                        e.nh = 0;
                        e.se || (e.se = 0);
                        e.gb || (e.gb = -1);
                        null != c && 0 < c.length && (c = c.toLowerCase());
                        e.Pd != c && (e.Cc = -1, e.Pd = c, e.se = 0, e.gb = -1, e.Bc = [], e.Bc.Re = []); - 1 == e.gb ? e.gb = parseInt(e.ua) : e.Cc = e.Cc + c.length;
                        0 == e.Bc.Re.length && e.Bc.searchText != c && d && (e.Bc.searchText != c && e.ka.find(".flowpaper_searchabstract_result, .flowpaper_searchabstract_result_separator").remove(), e.Bc.searchText = c, e.tj(), e.Nk(c));
                        for (; e.gb - 1 < h;) {
                            var l = f[e.gb - 1];
                            e.renderer.Ha && null == l && (jQuery(e.renderer).trigger("UIBlockingRenderingOperation", e.ja), e.$o = e.gb, e.renderer.Rc(e.gb, !1, function() {
                                l = f[e.gb - 1];
                                e.$o = null;
                            }));
                            e.Cc = l.indexOf(c, -1 == e.Cc ? 0 : e.Cc);
                            if (0 <= e.Cc) {
                                e.ua == e.gb || !(e.ba == e.na() && e.ua != e.gb + 1 || "BookView" == e.ba && e.ua != e.gb + 1 || "TwoPage" == e.ba && e.ua != e.gb - 1 || "SinglePage" == e.ba && e.ua != e.gb) || "TwoPage" != e.ba && "BookView" != e.ba && "SinglePage" != e.ba && e.ba != e.na() ? (e.se++, e.renderer.vb ? this.pages.getPage(e.gb - 1).load(function() {
                                    e.pages.getPage(e.gb - 1).xc(e.Pd, !1);
                                }) : ("Portrait" == e.ba && this.pages.getPage(e.gb - 1).load(function() {
                                    e.pages.getPage(e.gb - 1).xc(e.Pd, !1);
                                }), "TwoPage" != e.ba && "SinglePage" != e.ba && e.ba != e.na() || this.pages.getPage(e.gb - 1).xc(e.Pd, !1))) : e.gotoPage(e.gb, function() {
                                    e.Cc = e.Cc - c.length;
                                    e.searchText(c);
                                });
                                break;
                            }
                            e.gb++;
                            e.Cc = -1;
                            e.se = 0;
                        } - 1 == e.Cc && (e.Cc = -1, e.se = 0, e.gb = -1, e.oc(), alert(null != e.toolbar && null != e.toolbar.fb ? e.toolbar.Ga(e.toolbar.fb, "Finishedsearching") : "No more search matches."), e.gotoPage(1));
                    }
                }
            }
        },
        fitheight: function() {
            if (this.ba != this.na()) {
                try {
                    if (eb.platform.touchdevice) {
                        if (c = this.Me()) {
                            window.FitHeightScale = c, this.lb(c, {
                                Ig: !0
                            }), this.pages.vj();
                        }
                    } else {
                        var c = this.Me();
                        window.FitHeightScale = c;
                        jQuery(this.ea).trigger("onScaleChanged", c / this.document.MaxZoomSize);
                        c * this.document.MaxZoomSize >= this.document.MinZoomSize && c <= this.document.MaxZoomSize && ("Portrait" == this.ba ? this.lb(this.document.MaxZoomSize * c, {
                            Ig: !0
                        }) : this.lb(this.document.MaxZoomSize * c));
                    }
                } catch (d) {}
            }
        },
        Pg: function() {
            var c = jQuery(this.pages.da).width() - 15,
                d = 1 < this.getTotalPages() ? this.ua - 1 : 0;
            0 > d && (d = 0);
            this.document.DisplayRange && (d = parseInt(this.document.DisplayRange.split("-")[0]) - 1);
            var e = this.pages.getPage(d).dimensions.Ca / this.pages.getPage(d).dimensions.Na;
            return eb.platform.touchdevice ? c / (this.pages.getPage(d).ab * e) - ("SinglePage" == this.ba ? 0.1 : 0.03) : c / (this.pages.getPage(d).ab * this.document.MaxZoomSize * e) - 0.012;
        },
        Me: function() {
            if (this.document.DisableOverflow) {
                return window.FitHeightScale = 1;
            }
            this.ua - 1 && (this.ua = 1);
            if ("Portrait" == this.ba || "SinglePage" == this.ba || "TwoPage" == this.ba || "BookView" == this.ba) {
                var c = this.pages.getPage(this.ua - 1).dimensions.width / this.pages.getPage(this.ua - 1).dimensions.height;
                if (eb.platform.touchdevice) {
                    d = jQuery(this.ia).height() - ("TwoPage" == this.ba || "BookView" == this.ba ? 40 : 0), "SinglePage" == this.ba && (d -= 25), d /= this.pages.getPage(this.ua - 1).ab, e = this.pages.getPage(this.ua - 1), e = e.dimensions.Ca / e.dimensions.Na * e.ab * d, ("TwoPage" == this.ba || "BookView" == this.ba) && 2 * e > this.ia.width() && (d = this.ia.width() - 0, d /= 4 * this.pages.getPage(this.ua - 1).ab);
                } else {
                    var d = jQuery(this.pages.da).height() - ("TwoPage" == this.ba || "BookView" == this.ba ? 25 : 0),
                        d = d / (this.pages.getPage(this.ua - 1).ab * this.document.MaxZoomSize),
                        e = this.pages.getPage(this.ua - 1),
                        e = e.dimensions.Ca / e.dimensions.Na * e.ab * this.document.MaxZoomSize * d;
                    ("TwoPage" == this.ba || "BookView" == this.ba) && 2 * e > this.ia.width() && (d = (jQuery(this.ia).width() - ("TwoPage" == this.ba || "BookView" == this.ba ? 40 : 0)) / 1.48, d = d / 1.6 / (this.pages.getPage(this.ua - 1).ab * this.document.MaxZoomSize * c));
                }
                return window.FitHeightScale = d;
            }
            if (this.ba == this.na()) {
                return d = 1, window.FitHeightScale = d;
            }
        },
        next: function() {
            var c = this;
            c.Ui || c.ba == c.na() ? c.ba == c.na() && c.pages.next() : (c.Ui = setTimeout(function() {
                window.clearTimeout(c.Ui);
                c.Ui = null;
            }, 700), c.pages.next());
        },
        gotoPage: function(c, d) {
            var e = this;
            e.pages && ("ThumbView" == e.ba ? eb.platform.ios ? e.ca ? e.ca.Ap(c) : e.switchMode("Portrait", c) : e.switchMode("Portrait", c) : ("Portrait" == e.ba && e.pages.scrollTo(c), "SinglePage" == e.ba && setTimeout(function() {
                e.pages.Zf(c, d);
            }, 300), "TwoPage" != e.ba && "BookView" != e.ba || setTimeout(function() {
                e.pages.ag(c, d);
            }, 300), e.ca && e.ca.gotoPage(c, d)));
        },
        rotate: function() {
            this.pages.rotate(this.getCurrPage() - 1);
            window.annotations && (jQuery(".flowpaper_pageword_" + this.ja).remove(), this.fc(), this.pages.La());
        },
        getCurrPage: function() {
            return null != this.pages ? this.ba != this.na() ? this.pages.la + 1 : this.pages.la : 1;
        },
        Mo: function() {
            this.version = "2.4.9";
        },
        getTotalPages: function() {
            return this.pages.getTotalPages();
        },
        dd: function(c) {
            var d = this;
            d.ba != d.na() && (this.ua = c, this.pages.la = this.ua - 1);
            c > d.getTotalPages() && (c = c - 1, this.pages.la = c);
            "TwoPage" != this.ba && "BookView" != this.ba || this.pages.la != this.pages.getTotalPages() - 1 || 0 == this.pages.la % 2 || (this.pages.la = this.pages.la + 1);
            d.ca && (0 == c && (c++, this.ua = c), d.ca.dd(c));
            d.nd && (jQuery(".flowpaper_mark_video_maximized").remove(), jQuery(".flowpaper_mark_video_maximized_closebutton").remove(), d.nd = null);
            0 < jQuery(".flowpaper_mark_video").find("iframe,video").length && jQuery(".flowpaper_mark_video").find("iframe,video").each(function() {
                try {
                    var c = jQuery(this).closest(".flowpaper_page").attr("id"),
                        f = parseInt(c.substr(14, c.lastIndexOf("_") - 14));
                    if (0 == f && 0 != d.pages.la - 1 || 0 < f && f != d.pages.la - 1 && f != d.pages.la - 2) {
                        jQuery(this).parent().remove();
                        var h = d.pages.pages[f];
                        h.uf(h.Qi ? h.Qi : h.scale, h.Lc());
                    }
                } catch (l) {}
            });
            this.toolbar.Fp(c);
            null != d.plugin && ("TwoPage" == this.ba ? (d.plugin.Jg(this.pages.la + 1), d.plugin.Jg(this.pages.la + 2)) : "BookView" == this.ba ? (1 != c && d.plugin.Jg(this.pages.la), d.plugin.Jg(this.pages.la + 1)) : d.plugin.Jg(this.ua));
        },
        addLink: function(c, d, e, f, h, l) {
            window[this.Ji].addLink = this.addLink;
            c = parseInt(c);
            null == this.Aa[c - 1] && (this.Aa[c - 1] = []);
            var k = {
                type: "link"
            };
            k.href = d;
            k.Un = e;
            k.Vn = f;
            k.width = h;
            k.height = l;
            this.Aa[c - 1][this.Aa[c - 1].length] = k;
        },
        addVideo: function(c, d, e, f, h, l, k, m) {
            window[this.Ji].addVideo = this.addVideo;
            c = parseInt(c);
            null == this.Aa[c - 1] && (this.Aa[c - 1] = []);
            var n = {
                type: "video"
            };
            n.src = d;
            n.url = e;
            n.Tl = f;
            n.Ul = h;
            n.width = l;
            n.height = k;
            n.bo = m;
            this.Aa[c - 1][this.Aa[c - 1].length] = n;
        },
        addImage: function(c, d, e, f, h, l, k, m) {
            c = parseInt(c);
            null == this.Aa[c - 1] && (this.Aa[c - 1] = []);
            var n = {
                type: "image"
            };
            n.src = d;
            n.Di = e;
            n.Ei = f;
            n.width = h;
            n.height = l;
            n.href = k;
            n.Jn = m;
            this.Aa[c - 1][this.Aa[c - 1].length] = n;
        },
        openFullScreen: function() {
            var c = this,
                d = document.Db || document.mozFullScreen || document.webkitIsFullScreen || window.gn || window.Jh || document.fullscreenElement || document.msFullscreenElement,
                e = c.ka.get(0);
            if (d) {
                return document.exitFullscreen ? document.exitFullscreen() : document.mozCancelFullScreen ? document.mozCancelFullScreen() : document.webkitExitFullscreen ? document.webkitExitFullscreen() : document.msExitFullscreen && document.msExitFullscreen(), window.Jh && window.close(), !1;
            }
            "0" != c.ka.css("top") && (c.jo = c.ka.css("top"));
            "0" != c.ka.css("left") && (c.io = c.ka.css("left"));
            c.ba == c.na() && 1 < c.scale && (c.pages.fd(), c.fisheye.show(), c.fisheye.animate({
                opacity: 1
            }, 100));
            c.Ca = c.ka.width();
            c.Na = c.ka.height();
            c.PreviewMode && c.pages.Zk && (c.PreviewMode = !1, c.Ch = !0, c.ca.pb.xo(c.pages, c.ia), c.ca.Xo());
            c.ka.css({
                visibility: "hidden"
            });
            jQuery(document).bind("webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange", function() {
                setTimeout(function() {
                    if (window.navigator.standalone || document.fullScreenElement && null != document.fullScreenElement || document.mozFullScreen || document.webkitIsFullScreen) {
                        eb.browser.safari ? window.zine ? c.resize(screen.width, screen.height) : c.config.BottomToolbar ? c.resize(screen.width, screen.height - jQuery(c.ea).height() - 70) : c.resize(screen.width, screen.height - jQuery(c.ea).height()) : window.zine ? c.resize(window.outerWidth, window.outerHeight) : c.resize(window.innerWidth, window.innerHeight);
                    }
                    window.annotations && (jQuery(".flowpaper_pageword_" + c.ja).remove(), c.fc(), c.pages.La());
                    c.ka.css({
                        visibility: "visible"
                    });
                }, 500);
                jQuery(document).bind("webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange", function() {
                    jQuery(document).unbind("webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange");
                    c.Fi = !1;
                    c.ka.css({
                        top: c.jo,
                        left: c.io
                    });
                    c.Ch && (c.PreviewMode = !0, c.ca.Hk(), c.ca.Wg(), setTimeout(function() {
                        c.PreviewMode && c.ca.Wg();
                    }, 1000));
                    c.ba == c.na() && 1 < c.scale ? c.pages.fd(function() {
                        c.fisheye.show();
                        c.fisheye.animate({
                            opacity: 1
                        }, 100);
                        c.resize(c.Ca, c.Na - 2);
                        jQuery(c.ea).trigger("onFullscreenChanged", !1);
                    }) : (c.resize(c.Ca, c.Na - 2), jQuery(c.ea).trigger("onFullscreenChanged", !1));
                    jQuery(document).unbind("webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange");
                    c.Ch && (c.Ch = !1, c.ca.pb.Ih(c.pages, c.ia));
                    window.annotations && (jQuery(".flowpaper_pageword_" + c.ja).remove(), c.fc(), c.pages.La());
                });
                window.clearTimeout(c.hj);
                c.hj = setTimeout(function() {
                    !c.PreviewMode && c.ca && c.ca.Sf && c.ca.rj();
                }, 1000);
            });
            d = eb.platform.android && !e.webkitRequestFullScreen;
            c.document.FullScreenAsMaxWindow || !document.documentElement.requestFullScreen || d ? c.document.FullScreenAsMaxWindow || !document.documentElement.mozRequestFullScreen || d ? c.document.FullScreenAsMaxWindow || !document.documentElement.webkitRequestFullScreen || d ? !c.document.FullScreenAsMaxWindow && document.documentElement.msRequestFullscreen ? (c.ka.css({
                visibility: "hidden"
            }), c.Fi ? (c.Fi = !1, window.document.msExitFullscreen()) : (c.Fi = !0, e.msRequestFullscreen()), setTimeout(function() {
                c.ka.css({
                    visibility: "visible"
                });
                c.resize(window.outerWidth, window.outerHeight);
                window.annotations && (jQuery(".flowpaper_pageword_" + c.ja).remove(), c.fc(), c.pages.La());
            }, 500)) : (c.fo(), setTimeout(function() {
                c.ka.css({
                    visibility: "visible"
                });
            }, 500)) : (c.ka.css({
                visibility: "hidden"
            }), e.webkitRequestFullScreen(eb.browser.safari ? 0 : 1), c.ka.css({
                left: "0px",
                top: "0px"
            })) : (c.ka.css({
                visibility: "hidden"
            }), e.mozRequestFullScreen(), c.ka.css({
                left: "0px",
                top: "0px"
            })) : (c.ka.css({
                visibility: "hidden"
            }), e.requestFullScreen(), c.ka.css({
                left: "0px",
                top: "0px"
            }));
            jQuery(c.ea).trigger("onFullscreenChanged", !0);
        },
        fo: function() {
            var c = "",
                c = "toolbar=no, location=no, scrollbars=no, width=" + screen.width,
                c = c + (", height=" + screen.height),
                c = c + ", top=0, left=0, fullscreen=yes";
            nw = this.document.FullScreenAsMaxWindow ? window.open("") : window.open("", "windowname4", c);
            nw.params = c;
            c = "<!doctype html><head>";
            c += '<meta name="viewport" content="initial-scale=1,user-scalable=no,maximum-scale=1,width=device-width" />';
            c += '<link rel="stylesheet" type="text/css" href="' + this.config.cssDirectory + (-1 == this.config.cssDirectory.indexOf("flowpaper.css") ? "flowpaper.css" : "") + '" />';
            c += '<script type="text/javascript" src="' + this.config.jsDirectory + 'jquery.min.js">\x3c/script>';
            c += '<script type="text/javascript" src="' + this.config.jsDirectory + 'jquery.extensions.min.js">\x3c/script>';
            c += '<script type="text/javascript" src="' + this.config.jsDirectory + 'flowpaper.js">\x3c/script>';
            c += '<script type="text/javascript" src="' + this.config.jsDirectory + 'flowpaper_handlers.js">\x3c/script>';
            c += '<style type="text/css" media="screen">body{ margin:0; padding:0; overflow-x:hidden;overflow-y:hidden; }</style>';
            c += "</head>";
            c += '<body onload="openViewer();">';
            c += '<div id="documentViewer" class="flowpaper_viewer" style="position:absolute;left:0px;top:0px;width:100%;height:100%;"></div>';
            c += '<script type="text/javascript">';
            c += "function openViewer(){";
            c += 'jQuery("#documentViewer").FlowPaperViewer(';
            c += "{ config : {";
            c += "";
            c += 'SWFFile : "' + this.document.SWFFile + '",';
            c += 'IMGFiles : "' + this.document.IMGFiles + '",';
            c += 'JSONFile : "' + this.document.JSONFile + '",';
            c += 'PDFFile : "' + this.document.PDFFile + '",';
            c += "";
            c += "Scale : " + this.scale + ",";
            c += 'ZoomTransition : "' + this.document.ZoomTransition + '",';
            c += "ZoomTime : " + this.document.ZoomTime + ",";
            c += "ZoomInterval : " + this.document.ZoomInterval + ",";
            c += "FitPageOnLoad : " + this.document.FitPageOnLoad + ",";
            c += "FitWidthOnLoad : " + this.document.FitWidthOnLoad + ",";
            c += "FullScreenAsMaxWindow : " + this.document.FullScreenAsMaxWindow + ",";
            c += "ProgressiveLoading : " + this.document.ProgressiveLoading + ",";
            c += "MinZoomSize : " + this.document.MinZoomSize + ",";
            c += "MaxZoomSize : " + this.document.MaxZoomSize + ",";
            c += "MixedMode : " + this.document.MixedMode + ",";
            c += "SearchMatchAll : " + this.document.SearchMatchAll + ",";
            c += 'InitViewMode : "' + this.document.InitViewMode + '",';
            c += 'RenderingOrder : "' + this.document.RenderingOrder + '",';
            c += "useCustomJSONFormat : " + this.document.useCustomJSONFormat + ",";
            c += 'JSONDataType : "' + this.document.JSONDataType + '",';
            null != this.document.JSONPageDataFormat && (c += "JSONPageDataFormat : {", c += 'pageWidth : "' + this.document.JSONPageDataFormat.Qe + '",', c += 'pageHeight : "' + this.document.JSONPageDataFormat.Pe + '",', c += 'textCollection : "' + this.document.JSONPageDataFormat.we + '",', c += 'textFragment : "' + this.document.JSONPageDataFormat.Qb + '",', c += 'textFont : "' + this.document.JSONPageDataFormat.ng + '",', c += 'textLeft : "' + this.document.JSONPageDataFormat.xd + '",', c += 'textTop : "' + this.document.JSONPageDataFormat.yd + '",', c += 'textWidth : "' + this.document.JSONPageDataFormat.zd + '",', c += 'textHeight : "' + this.document.JSONPageDataFormat.wd + '"', c += "},");
            c += "ViewModeToolsVisible : " + this.document.ViewModeToolsVisible + ",";
            c += "ZoomToolsVisible : " + this.document.ZoomToolsVisible + ",";
            c += "NavToolsVisible : " + this.document.NavToolsVisible + ",";
            c += "CursorToolsVisible : " + this.document.CursorToolsVisible + ",";
            c += "SearchToolsVisible : " + this.document.SearchToolsVisible + ",";
            window.zine || (c += 'Toolbar : "' + escape(this.config.Toolbar) + '",');
            c += 'BottomToolbar : "' + this.config.BottomToolbar + '",';
            c += 'UIConfig : "' + this.document.UIConfig + '",';
            c += 'jsDirectory : "' + this.config.jsDirectory + '",';
            c += 'cssDirectory : "' + this.config.cssDirectory + '",';
            c += 'localeDirectory : "' + this.config.localeDirectory + '",';
            c += 'key : "' + this.config.key + '",';
            c += "";
            c += 'localeChain: "' + this.document.localeChain + '"';
            c += "}});";
            c += "}";
            c += "document.fullscreen = true;";
            c += "$(document).keyup(function(e) {if (e.keyCode == 27){window.close();}});";
            c += "\x3c/script>";
            c += "</body>";
            c += "</html>";
            nw.document.write(c);
            nw.Jh = !0;
            window.focus && nw.focus();
            nw.document.close();
            return !1;
        },
        resize: function(c, d, e, f) {
            var h = this;
            if (h.initialized) {
                h.width = null;
                if (h.ba == h.na()) {
                    h.ca.resize(c, d, e, f);
                } else {
                    var l = jQuery(h.ea).height() + 1 + 14,
                        k = 0 < h.Of ? h.Of + 1 : 0;
                    h.ia.css({
                        width: c,
                        height: d - l - k
                    });
                    null != e && 1 != e || this.ka.css({
                        width: c,
                        height: d
                    });
                    h.pages.resize(c, d - l - k, f);
                    jQuery(".flowpaper_interactiveobject_" + h.ja).remove();
                    jQuery(".flowpaper_pageword_" + h.ja).remove();
                    "TwoPage" != h.ba && "BookView" != h.ba || h.fitheight();
                    window.clearTimeout(h.no);
                    h.no = setTimeout(function() {
                        h.pages.La();
                    }, 700);
                }
                h.ca && h.ca.Sf && (window.clearTimeout(h.hj), h.hj = setTimeout(function() {
                    h.PreviewMode || h.ca.rj();
                }, 2500));
                h.cb && !h.ca ? h.ia.animate({
                    left: h.cb.width() / 2 + "px"
                }, 0) : h.cb && h.ca && h.ia.animate({
                    left: h.cb.width() + "px"
                }, 0);
            }
        }
    };
    f.loadFromUrl = f.loadFromUrl;
    return f;
}();
window.print_flowpaper_Document = function(f, c, d, e, g) {
    FLOWPAPER.Ek.init();
    f = Array(g + 1);
    var h = 0;
    if ("all" == d) {
        for (var l = 1; l < g + 1; l++) {
            f[l] = !0;
        }
        h = g;
    } else {
        if ("current" == d) {
            f[e] = !0, h = 1;
        } else {
            if (-1 == d.indexOf(",") && -1 < d.indexOf("-")) {
                for (var k = parseInt(d.substr(0, d.toString().indexOf("-"))), m = parseInt(d.substr(d.toString().indexOf("-") + 1)); k < m + 1; k++) {
                    f[k] = !0, h++;
                }
            } else {
                if (0 < d.indexOf(",")) {
                    for (var n = d.split(","), l = 0; l < n.length; l++) {
                        if (-1 < n[l].indexOf("-")) {
                            for (k = parseInt(n[l].substr(0, n[l].toString().indexOf("-"))), m = parseInt(n[l].substr(n[l].toString().indexOf("-") + 1)); k < m + 1; k++) {
                                f[k] = !0, h++;
                            }
                        } else {
                            f[parseInt(n[l].toString())] = !0, h++;
                        }
                    }
                }
            }
        }
    }
    jQuery(document.body).append("<div id='documentViewer' style='position:absolute;width:100%;height:100%'></div>");
    f = "1-" + g;
    window.Xh = 0;
    "current" == d ? f = e + "-" + e : "all" == d ? f = "1-" + g : f = d; - 1 == f.indexOf("-") && (f = f + "-" + f, h = 1);
    jQuery("#documentViewer").FlowPaperViewer({
        config: {
            IMGFiles: c.pageImagePattern,
            JSONFile: c.jsonfile && "undefined" != c.jsonfile ? c.jsonfile : null,
            PDFFile: c.PdfFile,
            JSONDataType: c.JSONDataType,
            RenderingOrder: null != c.jsonfile && "undefined" != c.jsonfile && 0 < c.jsonfile.length && null != c.pageImagePattern && 0 < c.pageImagePattern.length && "undefined" != c.pageImagePattern ? "html,html" : "html5,html",
            key: c.key,
            UserCollaboration: c.UserCollaboration,
            InitViewMode: "Portrait",
            DisableOverflow: !0,
            DisplayRange: f
        }
    });
    jQuery("#documentViewer").bind("onPageLoaded", function() {
        window.Xh == h - 1 && setTimeout(function() {
            if (window.parent.onPrintRenderingCompleted) {
                window.parent.onPrintRenderingCompleted();
            }
            window.focus && window.focus();
            window.print();
            window.close && window.close();
        }, 2000);
        window.Xh++;
        if (window.parent.onPrintRenderingProgress) {
            window.parent.onPrintRenderingProgress(window.Xh);
        }
    });
};
window.renderPrintPage = function Z(c, d) {
    "CanvasPageRenderer" == c.lf() && (d < c.getNumPages() ? c.Ha ? document.getElementById("ppage_" + d) ? c.Ni(d + 1, function() {
        if (parent.onPrintRenderingProgress) {
            parent.onPrintRenderingProgress(d + 1);
        }
        document.getElementById("ppage_" + d) ? c.Qa[d].getPage(1).then(function(e) {
            var g = document.getElementById("ppage_" + d);
            if (g) {
                var h = g.getContext("2d"),
                    l = e.getViewport(4),
                    h = {
                        canvasContext: h,
                        viewport: l,
                        uh: null,
                        continueCallback: function(c) {
                            c();
                        }
                    };
                g.width = l.width;
                g.height = l.height;
                e.render(h).promise.then(function() {
                    e.destroy();
                    Z(c, d + 1);
                }, function(c) {
                    console.log(c);
                });
            } else {
                Z(c, d + 1);
            }
        }) : Z(c, d + 1);
    }) : Z(c, d + 1) : document.getElementById("ppage_" + d) ? c.Qa.getPage(d + 1).then(function(e) {
        if (parent.onPrintRenderingProgress) {
            parent.onPrintRenderingProgress(d + 1);
        }
        var g = document.getElementById("ppage_" + d);
        if (g) {
            var h = g.getContext("2d"),
                l = e.getViewport(4),
                h = {
                    canvasContext: h,
                    viewport: l,
                    uh: null,
                    continueCallback: function(c) {
                        c();
                    }
                };
            g.width = l.width;
            g.height = l.height;
            e.render(h).promise.then(function() {
                Z(c, d + 1);
                e.destroy();
            }, function(c) {
                console.log(c);
            });
        } else {
            Z(c, d + 1);
        }
    }) : Z(c, d + 1) : (parent.onPrintRenderingCompleted(), window.print()));
};
oa && self.addEventListener("message", function(f) {
    f = f.data;
    if ("undefined" !== f.cmd) {
        switch (f.cmd) {
            case "loadImageResource":
                var c = new XMLHttpRequest;
                c.open("GET", "../../" + f.src);
                c.Db = c.responseType = "arraybuffer";
                c.onreadystatechange = function() {
                    if (4 == c.readyState && 200 == c.status) {
                        for (var d = new Uint8Array(this.response), e = d.length, f = Array(e); e--;) {
                            f[e] = String.fromCharCode(d[e]);
                        }
                        self.postMessage({
                            status: "ImageResourceLoaded",
                            blob: f.join("")
                        });
                        self.close();
                    }
                };
                c.send(null);
        }
    }
}, !1);