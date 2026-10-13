// 辰龙专属 Canvas 技能：待机神龙、飞行拖尾与命中爆发。
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};
  var Skill = {};
  var attackDragonImage = null;
  var attackDragonImageRequested = false;
  var attackDragonAssetPath = 'temp_image2ai/龙_透明图.png';

  if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src &&
      typeof URL !== 'undefined') {
    attackDragonAssetPath = new URL('../temp_image2ai/龙_透明图.png', document.currentScript.src).href;
  }

  function attackDragonImagePath() {
    return attackDragonAssetPath;
  }

  Skill.loadAttackDragonImage = function () {
    if (attackDragonImageRequested) return;
    attackDragonImageRequested = true;

    var platform = null;
    if (typeof wx !== 'undefined' && wx.createImage) platform = wx;
    else if (typeof tt !== 'undefined' && tt.createImage) platform = tt;

    try {
      if (platform) {
        attackDragonImage = platform.createImage();
      } else if (typeof Image !== 'undefined') {
        attackDragonImage = new Image();
      } else {
        return;
      }
      var imagePath = attackDragonImagePath();
      attackDragonImage.onerror = function () {
        attackDragonImage = null;
        if (typeof console !== 'undefined' && console.error) {
          console.error('[ChenLongSkill] Failed to load ' + imagePath);
        }
      };
      attackDragonImage.src = imagePath;
    } catch (e) {
      attackDragonImage = null;
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ChenLongSkill] Unable to load dragon artwork.', e);
      }
    }
  };

  function attackDragonImageReady() {
    Skill.loadAttackDragonImage();
    return attackDragonImage && attackDragonImage.complete !== false &&
      (attackDragonImage.naturalWidth || attackDragonImage.width) > 0;
  }

  // 坐标以约 110px 的龙身基准绘制，调用方按卡牌格子尺寸缩放。
  Skill.drawDragon = function (ctx, time, scale) {
    var sway = Math.sin((time || 0) * 5) * 2;
    ctx.save();
    ctx.scale(scale || 1, scale || 1);

    ctx.shadowColor = 'rgba(255,196,45,0.9)';
    ctx.shadowBlur = 11;
    ctx.strokeStyle = 'rgba(255,220,115,0.3)';
    ctx.lineWidth = 17;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-47, 8);
    ctx.bezierCurveTo(-32, -23 + sway, -2, -26, 9, -6);
    ctx.bezierCurveTo(21, 13, -10, 23, -5, 7);
    ctx.bezierCurveTo(1, -7, 26, -13, 39, -4);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#80510b';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(-47, 8);
    ctx.bezierCurveTo(-32, -23 + sway, -2, -26, 9, -6);
    ctx.bezierCurveTo(21, 13, -10, 23, -5, 7);
    ctx.bezierCurveTo(1, -7, 26, -13, 39, -4);
    ctx.stroke();
    ctx.strokeStyle = '#f1bd43';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-47, 8);
    ctx.bezierCurveTo(-32, -23 + sway, -2, -26, 9, -6);
    ctx.bezierCurveTo(21, 13, -10, 23, -5, 7);
    ctx.bezierCurveTo(1, -7, 26, -13, 39, -4);
    ctx.stroke();
    ctx.strokeStyle = '#fff1ad';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-42, 5);
    ctx.bezierCurveTo(-30, -17 + sway, -7, -21, 5, -5);
    ctx.bezierCurveTo(14, 9, -4, 17, -2, 7);
    ctx.bezierCurveTo(4, -3, 27, -10, 38, -4);
    ctx.stroke();

    // 飘逸龙尾
    ctx.fillStyle = '#f7d66c';
    ctx.beginPath();
    ctx.moveTo(-43, 8);
    ctx.quadraticCurveTo(-58, 2, -55, -12);
    ctx.quadraticCurveTo(-46, -7, -43, -2);
    ctx.quadraticCurveTo(-38, -15, -31, -16);
    ctx.quadraticCurveTo(-34, -3, -39, 8);
    ctx.closePath();
    ctx.fill();

    // 背鳍与鳞片亮线
    ctx.fillStyle = '#3a8ad0';
    for (var i = 0; i < 5; i++) {
      var sx = -28 + i * 10;
      var sy = i < 2 ? -13 + i * 4 : -3 - (i - 2) * 2;
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy + 4);
      ctx.lineTo(sx + 1, sy - 7);
      ctx.lineTo(sx + 5, sy + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,247,199,0.85)';
    ctx.lineWidth = 1.4;
    for (var sc = 0; sc < 5; sc++) {
      var px = -29 + sc * 10;
      ctx.beginPath();
      ctx.moveTo(px, -7 + sc * 1.5);
      ctx.lineTo(px + 4, -3 + sc * 1.5);
      ctx.stroke();
    }

    // 龙头、龙角与长须，朝向 +x。
    ctx.fillStyle = '#e8b43e';
    ctx.strokeStyle = '#80510b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(28, -11);
    ctx.quadraticCurveTo(37, -17, 45, -9);
    ctx.lineTo(56, -4);
    ctx.quadraticCurveTo(51, 2, 42, 2);
    ctx.quadraticCurveTo(32, 1, 27, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff0a0';
    ctx.beginPath();
    ctx.moveTo(34, -11); ctx.quadraticCurveTo(29, -24, 23, -23);
    ctx.quadraticCurveTo(28, -15, 31, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(41, -12); ctx.quadraticCurveTo(42, -25, 49, -26);
    ctx.quadraticCurveTo(47, -17, 46, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2e83cb';
    ctx.beginPath(); ctx.arc(44, -8, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff1ad';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(49, -1); ctx.quadraticCurveTo(58, 3, 64, -2);
    ctx.moveTo(47, 2); ctx.quadraticCurveTo(55, 10, 62, 8);
    ctx.stroke();

    // 向前探出的龙爪。
    ctx.strokeStyle = '#80510b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(31, 1);
    ctx.quadraticCurveTo(32, 11, 42, 14);
    ctx.stroke();
    ctx.fillStyle = '#f3ca58';
    ctx.beginPath();
    ctx.ellipse(44, 14, 6, 4, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2;
    for (var claw = -1; claw <= 1; claw++) {
      ctx.beginPath();
      ctx.moveTo(47, 13 + claw * 2);
      ctx.quadraticCurveTo(54, 14 + claw * 3, 56, 22 + claw * 3);
      ctx.stroke();
    }
    ctx.restore();
  };

  Skill.drawIdle = function (ctx, x, y, cardSize, time, alpha) {
    var bob = Math.sin((time || 0) * 2.4) * cardSize * 0.035;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y - cardSize * 0.91 + bob);
    ctx.globalCompositeOperation = 'lighter';
    var glow = ctx.createRadialGradient(0, 0, 1, 0, 0, cardSize * 0.43);
    glow.addColorStop(0, 'rgba(255,222,114,0.34)');
    glow.addColorStop(1, 'rgba(255,180,30,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, cardSize * 0.43, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // 待机龙保持原有的迷你代码绘制造型；透明设计图只用于攻击弹道。
    Skill.drawDragon(ctx, time, cardSize / 112);
    ctx.restore();
  };

  Skill.drawFlight = function (ctx, time, width) {
    if (attackDragonImageReady()) {
      var imageWidth = width;
      var imageHeight = imageWidth * attackDragonImage.height / attackDragonImage.width;
      ctx.save();
      // 原画龙首朝左下，旋转到弹道方向，让龙爪朝向目标。
      ctx.rotate(-2.0);
      ctx.shadowColor = '#ffd75d';
      ctx.shadowBlur = 12;
      ctx.drawImage(attackDragonImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
      ctx.restore();
      return;
    }
    Skill.drawDragon(ctx, time, width / 112);
  };

  Skill.drawTrail = function (ctx, points, x, y, cellSize) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var gradient = ctx.createLinearGradient(points[0].x, points[0].y, x, y);
    gradient.addColorStop(0, 'rgba(255,185,35,0)');
    gradient.addColorStop(0.65, 'rgba(255,190,45,0.32)');
    gradient.addColorStop(1, 'rgba(255,245,180,0.9)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(3, cellSize * 0.14);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = Math.max(1, cellSize * 0.035);
    ctx.stroke();
    ctx.restore();
  };

  Skill.drawImpact = function (ctx, effect, progress) {
    var k = Math.max(0, Math.min(1, progress));
    var fade = 1 - k;
    var radius = 12 + 38 * k;
    var seed = ((effect.x * 17 + effect.y * 31) | 0) >>> 0;
    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    var flash = ctx.createRadialGradient(effect.x, effect.y, 1, effect.x, effect.y, radius);
    flash.addColorStop(0, 'rgba(255,255,225,0.95)');
    flash.addColorStop(0.22, 'rgba(255,224,111,0.82)');
    flash.addColorStop(1, 'rgba(255,174,25,0)');
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.fill();

    for (var ring = 0; ring < 3; ring++) {
      ctx.globalAlpha = fade * (0.9 - ring * 0.2);
      ctx.strokeStyle = ring === 0 ? '#fff4b2' : '#f3b72f';
      ctx.lineWidth = Math.max(1, 3 - ring * 0.6);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 6 + k * (22 + ring * 11), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (var p = 0; p < 22; p++) {
      var angle = p * 2.399 + (seed % 100) * 0.01;
      var speed = 12 + random() * 34;
      var distance = speed * k;
      var size = (1.4 + random() * 2.8) * fade;
      ctx.globalAlpha = fade * (0.55 + random() * 0.45);
      ctx.fillStyle = p % 3 === 0 ? '#fff8cd' : (p % 3 === 1 ? '#ffd34e' : '#ef9f1b');
      ctx.beginPath();
      ctx.arc(
        effect.x + Math.cos(angle) * distance,
        effect.y + Math.sin(angle) * distance + 12 * k * k,
        size,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  };

  ZY.ChenLongSkill = Skill;
})();
