// 辰龙专属 Canvas 技能：盘旋待机、龙口火球与命中爆发。
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

  var DRAGON_MOUTH_ANGLE = 1.72;

  Skill.dragonCenter = function (x, y, cardSize, time) {
    return {
      x: x,
      y: y - cardSize * 0.78 + Math.sin((time || 0) * 2.4) * cardSize * 0.035
    };
  };

  Skill.mouthPosition = function (x, y, cardSize, angle, time) {
    var center = Skill.dragonCenter(x, y, cardSize, time);
    var mouthOffset = cardSize * 0.3;
    return {
      x: center.x + Math.cos(angle) * mouthOffset,
      y: center.y + Math.sin(angle) * mouthOffset
    };
  };

  Skill.drawIdle = function (ctx, x, y, cardSize, time, alpha, attackT, attackAngle) {
    var now = time || 0;
    var attack = Math.max(0, Math.min(1, 1 - (attackT || 0) / 0.35));
    var center = Skill.dragonCenter(x, y, cardSize, now);
    var idleAngle = now * 0.2 + Math.sin(now * 1.7) * 0.12;
    var angle = attackT > 0 && attackAngle != null
      ? attackAngle - DRAGON_MOUTH_ANGLE
      : idleAngle;
    var lunge = attackT > 0 ? Math.sin(attack * Math.PI) * cardSize * 0.12 : 0;
    var imageWidth = cardSize * (1.65 + attack * 0.08);
    var imageHeight = imageWidth * 1376 / 1760;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(
      center.x + Math.cos(angle + DRAGON_MOUTH_ANGLE) * lunge,
      center.y + Math.sin(angle + DRAGON_MOUTH_ANGLE) * lunge
    );
    ctx.rotate(angle);
    ctx.globalCompositeOperation = 'lighter';
    var glow = ctx.createRadialGradient(0, 0, 1, 0, 0, cardSize * 0.84);
    glow.addColorStop(0, 'rgba(255,222,114,0.34)');
    glow.addColorStop(1, 'rgba(255,180,30,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, cardSize * 0.84, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha *= 0.4 + Math.sin(now * 3.2) * 0.08;
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = Math.max(1, cardSize * 0.025);
    ctx.setLineDash([cardSize * 0.12, cardSize * 0.09]);
    ctx.lineDashOffset = -now * cardSize * 0.34;
    ctx.beginPath();
    ctx.ellipse(0, 0, cardSize * 0.78, cardSize * 0.47, now * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.shadowColor = '#ffd75d';
    ctx.shadowBlur = 9 + Math.sin(now * 4) * 3;
    if (attackDragonImageReady()) {
      // 素材右下角有生成水印，裁去空白角落而不裁伤龙身与龙尾。
      ctx.beginPath();
      ctx.moveTo(-imageWidth / 2, -imageHeight / 2);
      ctx.lineTo(imageWidth / 2, -imageHeight / 2);
      ctx.lineTo(imageWidth / 2, imageHeight * 0.38);
      ctx.lineTo(imageWidth * 0.36, imageHeight * 0.38);
      ctx.lineTo(imageWidth * 0.36, imageHeight / 2);
      ctx.lineTo(-imageWidth / 2, imageHeight / 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(attackDragonImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
    } else {
      Skill.drawDragon(ctx, now, cardSize / 112);
    }
    ctx.restore();

    for (var spark = 0; spark < 3; spark++) {
      var orbit = now * 1.8 + spark * Math.PI * 2 / 3;
      ctx.globalAlpha = (alpha == null ? 1 : alpha) * (0.55 + Math.sin(now * 5 + spark) * 0.2);
      ctx.fillStyle = spark === 1 ? '#fff4b0' : '#ffc83d';
      ctx.beginPath();
      ctx.arc(
        Math.cos(orbit) * cardSize * 0.75,
        Math.sin(orbit) * cardSize * 0.44,
        Math.max(1.5, cardSize * 0.035),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    if (attackT > 0 && attack > 0.08 && attack < 0.9) {
      ctx.save();
      ctx.translate(
        Math.cos(DRAGON_MOUTH_ANGLE) * cardSize * 0.3,
        Math.sin(DRAGON_MOUTH_ANGLE) * cardSize * 0.3
      );
      ctx.rotate(DRAGON_MOUTH_ANGLE);
      Skill.drawBreath(ctx, imageWidth * 0.08, now, imageWidth * 0.24, Math.sin(attack * Math.PI));
      ctx.restore();
    }
    ctx.restore();
  };

  Skill.drawBreath = function (ctx, size, time, length, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha) * (0.72 + Math.sin(time * 38) * 0.18);
    var flame = ctx.createLinearGradient(0, 0, length, 0);
    flame.addColorStop(0, 'rgba(255,255,220,0.98)');
    flame.addColorStop(0.28, 'rgba(255,228,91,0.95)');
    flame.addColorStop(0.72, 'rgba(255,105,24,0.72)');
    flame.addColorStop(1, 'rgba(255,55,14,0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.11);
    ctx.quadraticCurveTo(length * 0.4, -size * 0.25, length, 0);
    ctx.quadraticCurveTo(length * 0.45, size * 0.2, 0, size * 0.11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  Skill.drawFireball = function (ctx, time, size) {
    var pulse = 0.92 + Math.sin((time || 0) * 24) * 0.08;
    var radius = (size || 24) * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#ff5a16';
    ctx.shadowBlur = radius * 0.9;
    var flame = ctx.createRadialGradient(-radius * 0.2, 0, radius * 0.08, 0, 0, radius);
    flame.addColorStop(0, '#fffde0');
    flame.addColorStop(0.26, '#ffe66b');
    flame.addColorStop(0.62, '#ff8b1c');
    flame.addColorStop(1, 'rgba(230,45,8,0.12)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,238,139,0.95)';
    ctx.beginPath();
    ctx.ellipse(radius * 0.12, -radius * 0.05, radius * 0.46, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  Skill.drawTrail = function (ctx, points, x, y, cellSize) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var gradient = ctx.createLinearGradient(points[0].x, points[0].y, x, y);
    gradient.addColorStop(0, 'rgba(230,45,8,0)');
    gradient.addColorStop(0.65, 'rgba(255,95,20,0.34)');
    gradient.addColorStop(1, 'rgba(255,225,112,0.95)');
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
    flash.addColorStop(0, 'rgba(255,255,225,0.98)');
    flash.addColorStop(0.22, 'rgba(255,202,65,0.9)');
    flash.addColorStop(0.62, 'rgba(255,83,18,0.55)');
    flash.addColorStop(1, 'rgba(255,70,15,0)');
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.fill();

    for (var ring = 0; ring < 3; ring++) {
      ctx.globalAlpha = fade * (0.9 - ring * 0.2);
      ctx.strokeStyle = ring === 0 ? '#fff4b2' : (ring === 1 ? '#ffad32' : '#e84b18');
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
      ctx.fillStyle = p % 3 === 0 ? '#fff8cd' : (p % 3 === 1 ? '#ffd34e' : '#f05a1b');
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
