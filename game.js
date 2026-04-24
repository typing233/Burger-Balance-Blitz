// 汉堡堆叠大师游戏主逻辑
class BurgerGame {
    constructor() {
        // Matter.js 模块
        this.Engine = Matter.Engine;
        this.Render = Matter.Render;
        this.Runner = Matter.Runner;
        this.World = Matter.World;
        this.Bodies = Matter.Bodies;
        this.Events = Matter.Events;
        this.Body = Matter.Body;
        this.Composite = Matter.Composite;
        this.Bounds = Matter.Bounds;
        this.Vector = Matter.Vector;
        
        // 游戏状态
        this.gameState = 'idle'; // idle, playing, paused, gameover
        this.score = 0;
        this.multiplier = 1.0;
        this.timeLeft = 120; // 增加到120秒
        this.maxHeight = 0;
        this.currentHeight = 0;
        
        // 物理引擎相关
        this.engine = null;
        this.render = null;
        this.runner = null;
        this.world = null;
        this.canvas = null;
        this.canvasContainer = null;
        
        // 游戏对象
        this.baseBun = null;
        this.ingredients = [];
        this.draggedIngredient = null;
        this.isDragging = false;
        
        // 重心偏移检测
        this.centerOfMass = { x: 0, y: 0 };
        this.tiltStartTime = null;
        this.maxTiltAngle = 45 * (Math.PI / 180); // 45度转弧度
        this.tiltDuration = 2000; // 2秒
        
        // 顾客订单
        this.currentOrder = null;
        this.orderTimer = null;
        this.customerAngry = false;
        
        // 动态物理环境
        this.environmentEffects = {
            wind: { active: false, direction: 0, intensity: 0 },
            earthquake: { active: false, intensity: 0, duration: 0 }
        };
        this.environmentTimer = null;
        
        // 特殊食材效果
        this.jellyWobbleTime = 0;
        this.liquidParticles = [];
        
        // 倒塌反馈
        this.collapseEffects = {
            active: false,
            startTime: 0,
            duration: 2000
        };
        
        // 食材配置
        this.ingredientConfig = {
            lettuce: {
                name: '生菜',
                emoji: '🥬',
                width: 120,
                height: 30,
                mass: 0.5,
                restitution: 0.8, // 高弹性
                friction: 0.1,
                color: '#8BC34A',
                shape: 'rectangle',
                points: 10
            },
            cheese: {
                name: '奶酪',
                emoji: '🧀',
                width: 100,
                height: 15,
                mass: 0.3,
                restitution: 0.3,
                friction: 0.02, // 低摩擦（很滑）
                color: '#FFEB3B',
                shape: 'rectangle',
                points: 15
            },
            patty: {
                name: '肉饼',
                emoji: '🍖',
                width: 110,
                height: 40,
                mass: 2.0, // 厚重
                restitution: 0.2,
                friction: 0.3,
                color: '#795548',
                shape: 'rectangle',
                points: 25
            },
            tomato: {
                name: '番茄',
                emoji: '🍅',
                width: 80,
                height: 80,
                radius: 40,
                mass: 0.8,
                restitution: 0.5,
                friction: 0.1, // 圆形易滚
                color: '#F44336',
                shape: 'circle',
                points: 20
            },
            onion: {
                name: '洋葱圈',
                emoji: '🧅',
                width: 90,
                height: 90,
                outerRadius: 45,
                innerRadius: 30,
                mass: 0.4,
                restitution: 0.6,
                friction: 0.2,
                color: '#E91E63',
                shape: 'ring',
                points: 18
            },
            bacon: {
                name: '培根',
                emoji: '🥓',
                width: 130,
                height: 20,
                mass: 0.6,
                restitution: 0.4,
                friction: 0.15,
                color: '#FF5722',
                shape: 'rectangle',
                points: 12
            },
            jelly: {
                name: '果冻',
                emoji: '🍮',
                width: 110,
                height: 35,
                mass: 0.4,
                restitution: 1.2,
                friction: 0.01,
                frictionAir: 0.05,
                color: '#E91E63',
                shape: 'rectangle',
                points: 30,
                special: 'jelly',
                wobbleIntensity: 0.5,
                minScoreForUnlock: 500
            },
            egg: {
                name: '煎蛋',
                emoji: '🍳',
                width: 100,
                height: 25,
                mass: 0.3,
                restitution: 0.6,
                friction: 0.005,
                frictionAir: 0.02,
                color: '#FFEB3B',
                shape: 'irregular',
                points: 25,
                special: 'slippery',
                slipChance: 0.3,
                minScoreForUnlock: 300
            },
            pickle: {
                name: '酸黄瓜',
                emoji: '🥒',
                width: 90,
                height: 60,
                radius: 30,
                mass: 0.5,
                restitution: 0.8,
                friction: 0.1,
                color: '#4CAF50',
                shape: 'oval',
                points: 22,
                special: 'rollable',
                rollSpeed: 1.5,
                minScoreForUnlock: 200
            },
            sauce: {
                name: '酱汁',
                emoji: '🫗',
                width: 80,
                height: 15,
                mass: 0.2,
                restitution: 0.1,
                friction: 0.001,
                frictionAir: 0.1,
                color: '#795548',
                shape: 'liquid',
                points: 35,
                special: 'liquid',
                splashRadius: 50,
                minScoreForUnlock: 800
            }
        };
        
        // 顾客订单模板
        this.orderTemplates = [
            { text: '我要生菜在肉饼上面！', type: 'sequence', ingredients: ['patty', 'lettuce'] },
            { text: '给我一个番茄汉堡！', type: 'specific', ingredient: 'tomato', count: 2 },
            { text: '我要奶酪在最上面！', type: 'top', ingredient: 'cheese' },
            { text: '来一个全肉汉堡！', type: 'specific', ingredient: 'patty', count: 3 },
            { text: '我要健康一点，多放生菜！', type: 'specific', ingredient: 'lettuce', count: 3 },
            { text: '番茄加奶酪，完美组合！', type: 'sequence', ingredients: ['tomato', 'cheese'] },
            { text: '洋葱圈越多越好！', type: 'specific', ingredient: 'onion', count: 3 },
            { text: '培根配番茄，绝了！', type: 'sequence', ingredients: ['bacon', 'tomato'] }
        ];
        
        // 初始化
        this.init();
    }
    
    init() {
        // 获取DOM元素
        this.canvas = document.getElementById('game-canvas');
        this.canvasContainer = document.getElementById('canvas-container');
        
        // 绑定事件监听
        this.bindEvents();
        
        // 初始化物理引擎（游戏开始时再完全启动）
        this.initPhysics();
    }
    
    initPhysics() {
        // 创建引擎
        this.engine = this.Engine.create();
        this.world = this.engine.world;
        
        // 设置重力
        this.world.gravity.y = 1.0;
        
        // 获取画布尺寸
        const rect = this.canvasContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // 设置画布尺寸
        this.canvas.width = width;
        this.canvas.height = height;
        
        // 创建渲染器
        this.render = this.Render.create({
            canvas: this.canvas,
            engine: this.engine,
            options: {
                width: width,
                height: height,
                wireframes: false,
                background: 'transparent',
                showAngleIndicator: false,
                showCollisions: false,
                showVelocity: false
            }
        });
        
        // 创建边界和地面
        this.createBoundaries(width, height);
        
        // 创建面包底座
        this.createBaseBun(width, height);
    }
    
    createBoundaries(width, height) {
        const boundaryOptions = {
            isStatic: true,
            render: {
                visible: false
            }
        };
        
        // 地面
        const ground = this.Bodies.rectangle(width / 2, height + 50, width, 100, boundaryOptions);
        ground.label = 'ground';
        
        // 左边界
        const leftWall = this.Bodies.rectangle(-50, height / 2, 100, height * 2, boundaryOptions);
        leftWall.label = 'wall';
        
        // 右边界
        const rightWall = this.Bodies.rectangle(width + 50, height / 2, 100, height * 2, boundaryOptions);
        rightWall.label = 'wall';
        
        // 添加到世界
        this.World.add(this.world, [ground, leftWall, rightWall]);
    }
    
    createBaseBun(width, height) {
        // 面包底座配置
        const bunWidth = 150;
        const bunHeight = 40;
        const bunY = height - 60;
        
        // 创建面包底座（底部是平的，顶部有弧度）
        this.baseBun = this.Bodies.rectangle(width / 2, bunY, bunWidth, bunHeight, {
            isStatic: true,
            label: 'baseBun',
            render: {
                fillStyle: '#DEB887',
                strokeStyle: '#D2691E',
                lineWidth: 3
            },
            chamfer: {
                radius: [20, 20, 5, 5] // 顶部圆角，底部直角
            }
        });
        
        // 添加到世界
        this.World.add(this.world, this.baseBun);
    }
    
    bindEvents() {
        console.log('bindEvents called');
        
        // 游戏控制按钮
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const restartBtn = document.getElementById('restart-btn');
        const playAgainBtn = document.getElementById('play-again-btn');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                console.log('Start button clicked');
                this.startGame();
            });
        } else {
            console.error('Start button not found');
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
        }
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }
        
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => this.restartGame());
        }
        
        // 食材选择
        const ingredientItems = document.querySelectorAll('.ingredient-item');
        console.log('Found ingredient items:', ingredientItems.length);
        
        ingredientItems.forEach((item, index) => {
            console.log(`Binding events for ingredient item ${index}:`, item.dataset.type);
            
            item.addEventListener('mousedown', (e) => {
                console.log('mousedown event on ingredient:', item.dataset.type);
                this.startIngredientDrag(e, item);
            });
            
            item.addEventListener('touchstart', (e) => {
                console.log('touchstart event on ingredient:', item.dataset.type);
                this.startIngredientDrag(e, item);
            }, { passive: false });
        });
        
        // 鼠标移动和释放
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('touchmove', (e) => this.onMouseMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.onMouseUp(e));
        
        // 窗口大小改变
        window.addEventListener('resize', () => this.handleResize());
    }
    
    startIngredientDrag(e, item) {
        console.log('startIngredientDrag called, gameState:', this.gameState);
        
        if (this.gameState !== 'playing') {
            console.log('Game not in playing state, cannot drag');
            return;
        }
        
        // 检查是否是特殊食材且未解锁
        if (item.classList.contains('special-ingredient') && item.classList.contains('locked')) {
            console.log('Ingredient is locked, cannot drag');
            // 显示解锁提示
            const unlockScore = parseInt(item.dataset.unlockScore) || 0;
            this.showUnlockHint(unlockScore);
            return;
        }
        
        // 只在必要时阻止默认行为
        if (e.type === 'touchstart') {
            e.preventDefault();
        }
        
        const ingredientType = item.dataset.type;
        const config = this.ingredientConfig[ingredientType];
        
        if (!config) {
            console.log('No config found for type:', ingredientType);
            return;
        }
        
        console.log('Starting drag for:', ingredientType);
        
        // 显示拖拽指示器
        const indicator = document.getElementById('dragging-indicator');
        const icon = document.getElementById('dragging-icon');
        icon.textContent = config.emoji;
        indicator.classList.remove('hidden');
        
        // 记录拖拽状态
        this.isDragging = true;
        this.draggedIngredient = {
            type: ingredientType,
            config: config,
            startX: e.clientX || (e.touches && e.touches[0].clientX),
            startY: e.clientY || (e.touches && e.touches[0].clientY)
        };
        
        // 更新指示器位置
        this.updateDragIndicator(e);
    }
    
    onMouseMove(e) {
        if (!this.isDragging) return;
        this.updateDragIndicator(e);
    }
    
    updateDragIndicator(e) {
        const indicator = document.getElementById('dragging-indicator');
        
        // 处理不同类型的事件
        let x, y;
        if (e.type === 'touchmove' || e.type === 'touchstart') {
            if (e.touches && e.touches.length > 0) {
                x = e.touches[0].clientX;
                y = e.touches[0].clientY;
            }
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        
        if (x !== undefined && y !== undefined) {
            indicator.style.left = x + 'px';
            indicator.style.top = y + 'px';
        }
    }
    
    onMouseUp(e) {
        console.log('onMouseUp called, isDragging:', this.isDragging);
        
        if (!this.isDragging || !this.draggedIngredient) {
            this.isDragging = false;
            return;
        }
        
        // 只在必要时阻止默认行为
        if (e.type === 'touchend') {
            e.preventDefault();
        }
        
        // 隐藏拖拽指示器
        const indicator = document.getElementById('dragging-indicator');
        indicator.classList.add('hidden');
        
        // 获取释放位置
        let x, y;
        if (e.type === 'touchend') {
            if (e.changedTouches && e.changedTouches.length > 0) {
                x = e.changedTouches[0].clientX;
                y = e.changedTouches[0].clientY;
            } else if (e.touches && e.touches.length > 0) {
                x = e.touches[0].clientX;
                y = e.touches[0].clientY;
            }
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        
        console.log('Release position:', x, y);
        
        if (x === undefined || y === undefined) {
            console.log('Could not get release position');
            this.isDragging = false;
            this.draggedIngredient = null;
            return;
        }
        
        // 转换为画布坐标
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasX = x - canvasRect.left;
        const canvasY = y - canvasRect.top;
        
        console.log('Canvas position:', canvasX, canvasY);
        console.log('Canvas dimensions:', this.canvas.width, this.canvas.height);
        
        // 检查是否在画布范围内
        if (canvasX >= 0 && canvasX <= this.canvas.width && 
            canvasY >= 0 && canvasY <= this.canvas.height) {
            
            console.log('Creating ingredient:', this.draggedIngredient.type);
            // 创建食材物理体
            this.createIngredient(this.draggedIngredient.type, canvasX, canvasY);
        } else {
            console.log('Position outside canvas, not creating ingredient');
        }
        
        // 重置拖拽状态
        this.isDragging = false;
        this.draggedIngredient = null;
    }
    
    createIngredient(type, x, y) {
        const config = this.ingredientConfig[type];
        if (!config) return null;
        
        let body;
        
        // 根据形状创建不同的物理体
        switch (config.shape) {
            case 'circle':
                body = this.Bodies.circle(x, y, config.radius, {
                    label: `ingredient_${type}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: config.friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    }
                });
                break;
                
            case 'ring':
                // 使用多边形模拟洋葱圈
                const outerVertices = this.createCircleVertices(config.outerRadius, 16);
                const innerVertices = this.createCircleVertices(config.innerRadius, 16);
                
                // 简化处理：使用圆形，中间镂空通过渲染处理
                body = this.Bodies.circle(x, y, config.outerRadius, {
                    label: `ingredient_${type}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: config.friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    }
                });
                break;
                
            case 'oval':
                // 椭圆形（酸黄瓜）
                body = this.Bodies.circle(x, y, config.radius, {
                    label: `ingredient_${type}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: config.friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    }
                });
                break;
                
            case 'irregular':
                // 不规则形状（煎蛋）
                body = this.Bodies.rectangle(x, y, config.width, config.height, {
                    label: `ingredient_${type}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: config.friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    },
                    chamfer: { radius: 8 }
                });
                break;
                
            case 'liquid':
                // 液体（酱汁）
                body = this.Bodies.rectangle(x, y, config.width, config.height, {
                    label: `ingredient_${type}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: config.friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    }
                });
                break;
                
            default:
                // 矩形（生菜、奶酪、肉饼、培根）
                body = this.Bodies.rectangle(x, y, config.width, config.height, {
                    label: `ingredient_${type}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: config.friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    },
                    chamfer: type === 'bacon' ? { radius: 5 } : { radius: 3 }
                });
                break;
        }
        
        // 添加到世界
        this.World.add(this.world, body);
        
        // 记录食材
        const ingredient = {
            body: body,
            type: type,
            config: config,
            added: Date.now(),
            specialEffects: {
                wobblePhase: Math.random() * Math.PI * 2,
                lastSlipTime: 0
            }
        };
        
        this.ingredients.push(ingredient);
        
        // 触发特殊食材的初始效果
        this.applySpecialIngredientEffects(ingredient);
        
        return body;
    }
    
    applySpecialIngredientEffects(ingredient) {
        const config = ingredient.config;
        
        if (!config.special) return;
        
        switch (config.special) {
            case 'jelly':
                // 果冻的晃动效果会在游戏循环中处理
                break;
                
            case 'slippery':
                // 煎蛋的易滑落效果会在碰撞时处理
                break;
                
            case 'rollable':
                // 酸黄瓜的滚动效果会在游戏循环中处理
                break;
                
            case 'liquid':
                // 酱汁的液体效果会在碰撞时处理
                break;
        }
    }
    
    createCircleVertices(radius, segments) {
        const vertices = [];
        for (let i = 0; i < segments; i++) {
            const angle = (Math.PI * 2 * i) / segments;
            vertices.push({
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
        }
        return vertices;
    }
    
    darkenColor(color, percent) {
        // 简单的颜色加深函数
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }
    
    startGame() {
        if (this.gameState === 'playing') return;
        
        // 重置游戏状态
        this.resetGame();
        
        // 更新游戏状态
        this.gameState = 'playing';
        
        // 启动渲染和引擎
        this.Render.run(this.render);
        this.runner = this.Runner.create();
        this.Runner.run(this.runner, this.engine);
        
        // 启动游戏循环
        this.gameLoop();
        
        // 启动计时器
        this.startTimer();
        
        // 启动顾客订单
        this.startOrderSystem();
        
        // 启动动态物理环境
        this.startEnvironmentSystem();
        
        // 更新UI
        this.updateUI();
        
        // 显示/隐藏按钮
        document.getElementById('start-btn').classList.add('hidden');
        document.getElementById('pause-btn').classList.remove('hidden');
        document.getElementById('restart-btn').classList.remove('hidden');
    }
    
    resetGame() {
        console.log('resetGame called');
        // 重置分数和时间
        this.score = 0;
        this.multiplier = 1.0;
        this.timeLeft = 120; // 与构造函数保持一致
        this.maxHeight = 0;
        this.currentHeight = 0;
        
        // 重置倾斜检测
        this.tiltStartTime = null;
        
        // 清空食材
        if (this.ingredients.length > 0) {
            this.ingredients.forEach(ing => {
                if (ing.body) {
                    this.World.remove(this.world, ing.body);
                }
            });
            this.ingredients = [];
        }
        
        // 清空订单
        this.currentOrder = null;
        if (this.orderTimer) {
            clearTimeout(this.orderTimer);
            this.orderTimer = null;
        }
        
        // 隐藏订单
        document.getElementById('customer-order').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
        
        // 重置动态物理环境
        this.environmentEffects.wind.active = false;
        this.environmentEffects.earthquake.active = false;
        if (this.environmentTimer) {
            clearInterval(this.environmentTimer);
            this.environmentTimer = null;
        }
        
        // 重置特殊食材效果
        this.jellyWobbleTime = 0;
        
        // 清理液体粒子
        this.cleanupLiquidParticles();
        
        // 重置倒塌反馈
        this.collapseEffects.active = false;
        
        // 重置客户状态
        this.customerAngry = false;
    }
    
    startEnvironmentSystem() {
        // 随机触发环境效果
        this.environmentTimer = setInterval(() => {
            if (this.gameState !== 'playing') return;
            
            // 10%的几率触发环境效果
            if (Math.random() < 0.1) {
                // 50%大风，50%地震
                if (Math.random() < 0.5) {
                    this.triggerWindEffect();
                } else {
                    this.triggerEarthquakeEffect();
                }
            }
        }, 5000); // 每5秒检查一次
    }
    
    triggerWindEffect() {
        // 大风效果持续5-10秒
        const duration = 5000 + Math.random() * 5000;
        const intensity = 0.5 + Math.random() * 1.5; // 风力强度
        const direction = Math.random() > 0.5 ? 1 : -1; // 风向（左或右）
        
        this.environmentEffects.wind = {
            active: true,
            intensity: intensity,
            direction: direction
        };
        
        // 显示大风提示
        this.showEnvironmentEffectAlert('🌬️ 大风来袭！注意保持平衡！');
        
        // 设置大风结束
        setTimeout(() => {
            this.environmentEffects.wind.active = false;
        }, duration);
    }
    
    triggerEarthquakeEffect() {
        // 地震效果持续2-5秒
        const duration = 2000 + Math.random() * 3000;
        const intensity = 1.0 + Math.random() * 2.0; // 地震强度
        
        this.environmentEffects.earthquake = {
            active: true,
            intensity: intensity,
            duration: duration,
            startTime: Date.now()
        };
        
        // 显示地震提示
        this.showEnvironmentEffectAlert('🌋 地震！汉堡要倒了！');
    }
    
    showEnvironmentEffectAlert(message) {
        // 创建临时提示元素
        const alert = document.createElement('div');
        alert.className = 'environment-alert';
        alert.textContent = message;
        alert.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 1.5rem;
            font-weight: bold;
            z-index: 2000;
            animation: shake 0.5s ease-in-out infinite;
            pointer-events: none;
        `;
        
        document.body.appendChild(alert);
        
        // 2秒后移除
        setTimeout(() => {
            alert.remove();
        }, 2000);
    }
    
    gameLoop() {
        if (this.gameState !== 'playing') return;
        
        // 更新动态物理环境
        this.updateEnvironmentEffects();
        
        // 更新特殊食材效果
        this.updateSpecialIngredientEffects();
        
        // 检查游戏状态
        this.checkGameConditions();
        
        // 更新得分和高度
        this.updateScoreAndHeight();
        
        // 计算重心偏移
        this.calculateCenterOfMass();
        
        // 更新倒塌反馈
        this.updateCollapseEffects();
        
        // 继续循环
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updateEnvironmentEffects() {
        const now = Date.now();
        
        // 大风效果
        if (this.environmentEffects.wind.active) {
            const wind = this.environmentEffects.wind;
            const windForce = wind.intensity * wind.direction;
            
            // 对所有食材施加风力
            this.ingredients.forEach(ing => {
                if (ing.body) {
                    this.Body.applyForce(ing.body, ing.body.position, {
                        x: windForce * 0.001 * ing.body.mass,
                        y: 0
                    });
                }
            });
        }
        
        // 地震效果
        if (this.environmentEffects.earthquake.active) {
            const quake = this.environmentEffects.earthquake;
            const quakeTime = now - quake.startTime;
            
            if (quakeTime < quake.duration) {
                // 随机震动
                const shakeX = (Math.random() - 0.5) * quake.intensity * 2;
                const shakeY = (Math.random() - 0.5) * quake.intensity * 2;
                
                // 对所有食材施加震动
                this.ingredients.forEach(ing => {
                    if (ing.body) {
                        this.Body.applyForce(ing.body, ing.body.position, {
                            x: shakeX * 0.001 * ing.body.mass,
                            y: shakeY * 0.001 * ing.body.mass
                        });
                    }
                });
            } else {
                // 地震结束
                this.environmentEffects.earthquake.active = false;
            }
        }
    }
    
    updateSpecialIngredientEffects() {
        const now = Date.now();
        this.jellyWobbleTime += 0.05;
        
        this.ingredients.forEach(ing => {
            if (!ing.body || !ing.config.special) return;
            
            const config = ing.config;
            const body = ing.body;
            
            switch (config.special) {
                case 'jelly':
                    // 果冻晃动效果
                    const wobble = Math.sin(this.jellyWobbleTime + ing.specialEffects.wobblePhase) * config.wobbleIntensity;
                    this.Body.setAngularVelocity(body, body.angularVelocity + wobble * 0.01);
                    
                    // 随机弹跳
                    if (Math.random() < 0.01) {
                        const bounceForce = (Math.random() - 0.5) * 0.002;
                        this.Body.applyForce(body, body.position, {
                            x: bounceForce,
                            y: -Math.abs(bounceForce)
                        });
                    }
                    break;
                    
                case 'slippery':
                    // 煎蛋易滑落效果
                    const slipChance = config.slipChance;
                    const currentAngle = Math.abs(body.angle);
                    
                    // 角度越大，滑落几率越高
                    const adjustedSlipChance = slipChance * (1 + currentAngle * 2);
                    
                    if (Math.random() < adjustedSlipChance * 0.01) {
                        // 随机方向滑动
                        const slipDirection = Math.random() > 0.5 ? 1 : -1;
                        this.Body.applyForce(body, body.position, {
                            x: slipDirection * 0.005,
                            y: 0
                        });
                    }
                    break;
                    
                case 'rollable':
                    // 酸黄瓜滚动效果
                    // 圆形物体自然会滚动，但可以增加一些随机性
                    if (Math.abs(body.angularVelocity) < 0.5 && Math.random() < 0.005) {
                        const rollDirection = Math.random() > 0.5 ? 1 : -1;
                        this.Body.setAngularVelocity(body, body.angularVelocity + rollDirection * config.rollSpeed * 0.1);
                    }
                    break;
                    
                case 'liquid':
                    // 酱汁液体效果 - 当碰撞或掉落时产生飞溅
                    if (body.velocity.y > 5 && Math.random() < 0.1) {
                        this.createLiquidSplash(body.position.x, body.position.y, config.splashRadius);
                    }
                    break;
            }
        });
    }
    
    createLiquidSplash(x, y, radius) {
        // 创建液体飞溅粒子效果
        const particleCount = 5 + Math.floor(Math.random() * 5);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
            const speed = 2 + Math.random() * 3;
            const size = 3 + Math.random() * 5;
            
            const particle = this.Bodies.circle(
                x + Math.cos(angle) * 10,
                y + Math.sin(angle) * 10,
                size,
                {
                    label: 'liquid_particle',
                    mass: 0.05,
                    restitution: 0.3,
                    friction: 0.01,
                    frictionAir: 0.1,
                    render: {
                        fillStyle: '#795548',
                        opacity: 0.8
                    }
                }
            );
            
            // 给粒子初始速度
            this.Body.setVelocity(particle, {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed - 2
            });
            
            this.World.add(this.world, particle);
            
            // 记录粒子，稍后移除
            this.liquidParticles.push({
                body: particle,
                createdAt: Date.now(),
                lifetime: 2000 + Math.random() * 1000
            });
        }
        
        // 清理过期粒子
        this.cleanupLiquidParticles();
    }
    
    cleanupLiquidParticles() {
        const now = Date.now();
        
        for (let i = this.liquidParticles.length - 1; i >= 0; i--) {
            const particle = this.liquidParticles[i];
            
            if (now - particle.createdAt > particle.lifetime) {
                this.World.remove(this.world, particle.body);
                this.liquidParticles.splice(i, 1);
            }
        }
    }
    
    updateCollapseEffects() {
        if (!this.collapseEffects.active) return;
        
        const now = Date.now();
        const elapsed = now - this.collapseEffects.startTime;
        
        if (elapsed >= this.collapseEffects.duration) {
            this.collapseEffects.active = false;
            return;
        }
        
        // 倒塌效果持续期间的处理
        // 可以添加一些视觉震动或其他效果
    }
    
    checkGameConditions() {
        // 1. 检查食材是否掉落出边界
        this.checkFallenIngredients();
        
        // 2. 检查整体倾斜角度
        this.checkTiltAngle();
        
        // 3. 检查时间（在计时器中处理）
    }
    
    checkFallenIngredients() {
        const canvasHeight = this.canvas.height;
        
        for (let i = this.ingredients.length - 1; i >= 0; i--) {
            const ing = this.ingredients[i];
            if (!ing.body) continue;
            
            // 检查是否掉落出画布底部
            if (ing.body.position.y > canvasHeight + 100) {
                // 食材掉落，游戏结束
                this.endGame('有食材掉落到了桌面外！');
                return;
            }
        }
    }
    
    checkTiltAngle() {
        if (this.ingredients.length < 2) return; // 至少需要2个食材才会有倾斜问题
        
        // 计算整体倾斜角度
        const tiltAngle = this.calculateOverallTilt();
        
        // 检查是否超过45度
        if (Math.abs(tiltAngle) > this.maxTiltAngle) {
            if (!this.tiltStartTime) {
                this.tiltStartTime = Date.now();
            } else {
                const elapsed = Date.now() - this.tiltStartTime;
                if (elapsed >= this.tiltDuration) {
                    // 倾斜超过2秒，游戏结束
                    this.endGame('汉堡倾斜超过45度并持续了2秒！');
                    return;
                }
            }
        } else {
            // 倾斜恢复，重置计时器
            this.tiltStartTime = null;
        }
    }
    
    calculateOverallTilt() {
        if (this.ingredients.length === 0) return 0;
        
        // 计算所有食材的平均角度
        let totalAngle = 0;
        let validCount = 0;
        
        this.ingredients.forEach(ing => {
            if (ing.body) {
                totalAngle += ing.body.angle;
                validCount++;
            }
        });
        
        if (validCount === 0) return 0;
        
        return totalAngle / validCount;
    }
    
    updateScoreAndHeight() {
        if (this.ingredients.length === 0) return;
        
        // 计算当前高度（从面包底座到最高食材的距离）
        let minY = Infinity;
        
        this.ingredients.forEach(ing => {
            if (ing.body) {
                const bounds = ing.body.bounds;
                if (bounds.min.y < minY) {
                    minY = bounds.min.y;
                }
            }
        });
        
        // 面包底座的顶部Y坐标
        const baseTopY = this.baseBun.bounds.min.y;
        
        // 计算高度（像素转换为分数单位）
        this.currentHeight = Math.max(0, baseTopY - minY);
        this.maxHeight = Math.max(this.maxHeight, this.currentHeight);
        
        // 计算得分倍率（高度越高倍率越大）
        // 基础倍率1.0，每增加100像素增加0.5倍
        this.multiplier = 1.0 + Math.floor(this.currentHeight / 100) * 0.5;
        
        // 最近添加的食材给予分数
        const now = Date.now();
        this.ingredients.forEach(ing => {
            if (!ing.scored && ing.added && (now - ing.added) > 1000) {
                // 食材稳定1秒后计分
                const basePoints = ing.config.points;
                const finalPoints = Math.floor(basePoints * this.multiplier);
                this.score += finalPoints;
                ing.scored = true;
                
                // 检查订单
                this.checkOrderCompletion(ing.type);
            }
        });
        
        // 更新UI
        this.updateUI();
    }
    
    calculateCenterOfMass() {
        // 确保 baseBun 存在且有基本属性
        if (!this.baseBun || !this.baseBun.position) {
            this.updateCenterOfMassIndicator(0);
            return;
        }
        
        // 初始化重心为面包底座的位置
        this.centerOfMass = { 
            x: this.baseBun.position.x, 
            y: this.baseBun.position.y 
        };
        
        // 如果没有食材，直接返回0%偏移
        if (this.ingredients.length === 0) {
            this.updateCenterOfMassIndicator(0);
            return;
        }
        
        // 计算所有食材的加权重心
        let totalMass = 0;
        let weightedX = 0;
        let weightedY = 0;
        
        // 包含面包底座（使用固定质量值）
        const baseMass = 10;
        totalMass += baseMass;
        weightedX += this.baseBun.position.x * baseMass;
        weightedY += this.baseBun.position.y * baseMass;
        
        // 添加所有食材的质量
        this.ingredients.forEach(ing => {
            if (ing.body && ing.body.position) {
                const mass = ing.body.mass || 1;
                totalMass += mass;
                weightedX += ing.body.position.x * mass;
                weightedY += ing.body.position.y * mass;
            }
        });
        
        // 计算重心
        if (totalMass > 0 && isFinite(totalMass)) {
            this.centerOfMass = {
                x: weightedX / totalMass,
                y: weightedY / totalMass
            };
        }
        
        // 计算相对于底座中心的偏移百分比
        const baseCenterX = this.baseBun.position.x;
        
        // 获取面包底座的半宽度（使用固定值或从bounds计算）
        let baseHalfWidth = 75; // 默认值：150像素宽度的一半
        
        // 尝试从 bounds 获取宽度
        if (this.baseBun.bounds && 
            this.baseBun.bounds.max && 
            this.baseBun.bounds.min &&
            isFinite(this.baseBun.bounds.max.x) && 
            isFinite(this.baseBun.bounds.min.x)) {
            const baseFullWidth = this.baseBun.bounds.max.x - this.baseBun.bounds.min.x;
            if (baseFullWidth > 0) {
                baseHalfWidth = baseFullWidth / 2; // 计算半宽
            }
        }
        
        // 计算偏移百分比
        let offsetPercent = 0;
        
        if (this.centerOfMass && isFinite(this.centerOfMass.x) && isFinite(baseCenterX) && baseHalfWidth > 0) {
            const offsetX = this.centerOfMass.x - baseCenterX;
            offsetPercent = (offsetX / baseHalfWidth) * 100;
            
            // 确保值是有限的
            if (!isFinite(offsetPercent)) {
                offsetPercent = 0;
            }
        }
        
        // 更新UI指示器
        this.updateCenterOfMassIndicator(offsetPercent);
    }
    
    updateCenterOfMassIndicator(offsetPercent) {
        const indicatorBar = document.getElementById('indicator-bar');
        const indicatorValue = document.getElementById('indicator-value');
        
        // 确保输入值是有效的数字
        let safePercent = 0;
        if (typeof offsetPercent === 'number' && isFinite(offsetPercent)) {
            safePercent = offsetPercent;
        }
        
        // 限制在-100到100之间
        const clampedPercent = Math.max(-100, Math.min(100, safePercent));
        
        // 计算位置（从左到右0%到100%，中心是50%）
        const positionPercent = 50 + (clampedPercent / 2);
        
        // 更新UI
        if (indicatorBar) {
            indicatorBar.style.left = positionPercent + '%';
        }
        
        if (indicatorValue) {
            indicatorValue.textContent = Math.round(Math.abs(clampedPercent)) + '%';
        }
        
        // 根据偏移程度改变颜色
        if (indicatorBar) {
            if (Math.abs(clampedPercent) > 70) {
                indicatorBar.style.background = '#F44336'; // 红色
            } else if (Math.abs(clampedPercent) > 40) {
                indicatorBar.style.background = '#FF9800'; // 橙色
            } else {
                indicatorBar.style.background = '#333'; // 正常
            }
        }
    }
    
    startTimer() {
        const timerInterval = setInterval(() => {
            if (this.gameState !== 'playing') {
                clearInterval(timerInterval);
                return;
            }
            
            this.timeLeft--;
            document.getElementById('timer').textContent = this.timeLeft;
            
            if (this.timeLeft <= 0) {
                clearInterval(timerInterval);
                this.endGame('时间耗尽！');
            }
        }, 1000);
    }
    
    startOrderSystem() {
        // 随机生成第一个订单（延迟5秒）
        this.orderTimer = setTimeout(() => {
            this.generateNewOrder();
        }, 5000);
    }
    
    generateNewOrder() {
        if (this.gameState !== 'playing') return;
        
        // 重置客户状态
        this.customerAngry = false;
        
        // 随机选择订单
        const template = this.orderTemplates[Math.floor(Math.random() * this.orderTemplates.length)];
        
        this.currentOrder = {
            ...template,
            startTime: Date.now(),
            timeLimit: 30000 // 30秒内完成
        };
        
        // 显示订单 - 正常表情
        this.updateCustomerOrderDisplay(template.text, false);
        document.getElementById('customer-order').classList.remove('hidden');
        
        // 订单计时器
        this.orderTimer = setTimeout(() => {
            if (this.currentOrder && !this.currentOrder.completed) {
                // 订单超时，客户发怒
                this.triggerCustomerAngry();
            }
        }, 30000);
        
        // 订单剩余时间警告（10秒时）
        setTimeout(() => {
            if (this.currentOrder && !this.currentOrder.completed && this.gameState === 'playing') {
                this.showOrderWarning();
            }
        }, 20000);
    }
    
    updateCustomerOrderDisplay(text, isAngry) {
        document.getElementById('order-content').textContent = text;
        
        const customerEmoji = document.querySelector('.customer-emoji');
        if (customerEmoji) {
            customerEmoji.textContent = isAngry ? '😠' : '👤';
        }
        
        const orderBubble = document.querySelector('.order-bubble');
        if (orderBubble) {
            orderBubble.style.background = isAngry ? '#FFCDD2' : 'white';
            orderBubble.style.animation = isAngry ? 'shake 0.3s ease-in-out infinite' : '';
        }
    }
    
    showOrderWarning() {
        if (!this.currentOrder || this.currentOrder.completed) return;
        
        // 显示警告，客户开始不耐烦
        const warningText = '快点！我赶时间！';
        this.updateCustomerOrderDisplay(warningText, false);
        
        // 让客户表情变得不耐烦
        const customerEmoji = document.querySelector('.customer-emoji');
        if (customerEmoji) {
            customerEmoji.textContent = '😐';
        }
        
        // 闪烁警告
        const orderBubble = document.querySelector('.order-bubble');
        if (orderBubble) {
            orderBubble.style.animation = 'pulse 0.5s ease-in-out infinite';
        }
    }
    
    triggerCustomerAngry() {
        if (!this.currentOrder || this.currentOrder.completed) return;
        
        this.customerAngry = true;
        
        // 客户发怒
        const angryText = '什么？让我等这么久！我不吃了！';
        this.updateCustomerOrderDisplay(angryText, true);
        
        // 减少分数
        this.score = Math.max(0, this.score - 100);
        this.updateUI();
        
        // 显示发怒特效
        this.showAngryEffect();
        
        // 3秒后隐藏订单并生成新订单
        setTimeout(() => {
            document.getElementById('customer-order').classList.add('hidden');
            this.currentOrder = null;
            this.customerAngry = false;
            
            // 恢复样式
            const orderBubble = document.querySelector('.order-bubble');
            if (orderBubble) {
                orderBubble.style.background = 'white';
                orderBubble.style.animation = '';
            }
            
            // 生成新订单
            setTimeout(() => this.generateNewOrder(), 2000);
        }, 3000);
    }
    
    showAngryEffect() {
        // 创建发怒特效
        const effect = document.createElement('div');
        effect.className = 'angry-effect';
        effect.innerHTML = '💢';
        effect.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 5rem;
            z-index: 2000;
            animation: angryPop 0.5s ease-out forwards;
            pointer-events: none;
        `;
        
        document.body.appendChild(effect);
        
        // 添加CSS动画
        if (!document.querySelector('#angry-animations')) {
            const style = document.createElement('style');
            style.id = 'angry-animations';
            style.textContent = `
                @keyframes angryPop {
                    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                    50% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
                }
                @keyframes pulse {
                    0%, 100% { transform: translateX(-50%) scale(1); }
                    50% { transform: translateX(-50%) scale(1.05); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(-50%) rotate(0deg); }
                    25% { transform: translateX(-50%) rotate(-5deg); }
                    75% { transform: translateX(-50%) rotate(5deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // 1秒后移除特效
        setTimeout(() => {
            effect.remove();
        }, 1000);
    }
    
    checkOrderCompletion(ingredientType) {
        if (!this.currentOrder || this.currentOrder.completed) return;
        
        let completed = false;
        let bonusPoints = 0;
        
        switch (this.currentOrder.type) {
            case 'specific':
                // 检查是否放置了指定数量的特定食材
                const count = this.ingredients.filter(ing => 
                    ing.type === this.currentOrder.ingredient && ing.scored
                ).length;
                
                if (count >= this.currentOrder.count) {
                    completed = true;
                    bonusPoints = 100;
                }
                break;
                
            case 'sequence':
                // 检查是否按顺序放置了食材
                // 简化处理：检查是否有这些食材
                const types = this.ingredients.filter(ing => ing.scored).map(ing => ing.type);
                const hasAll = this.currentOrder.ingredients.every(type => types.includes(type));
                
                if (hasAll) {
                    completed = true;
                    bonusPoints = 150;
                }
                break;
                
            case 'top':
                // 检查最高的食材是否是指定类型
                const sortedByHeight = [...this.ingredients]
                    .filter(ing => ing.scored && ing.body)
                    .sort((a, b) => a.body.position.y - b.body.position.y);
                
                if (sortedByHeight.length > 0 && sortedByHeight[0].type === this.currentOrder.ingredient) {
                    completed = true;
                    bonusPoints = 120;
                }
                break;
        }
        
        if (completed) {
            this.currentOrder.completed = true;
            this.score += bonusPoints;
            this.updateUI();
            
            // 隐藏订单
            setTimeout(() => {
                document.getElementById('customer-order').classList.add('hidden');
                this.currentOrder = null;
                
                // 生成新订单
                setTimeout(() => this.generateNewOrder(), 5000);
            }, 2000);
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('multiplier').textContent = 'x' + this.multiplier.toFixed(1);
        document.getElementById('height').textContent = Math.round(this.currentHeight);
        
        // 更新特殊食材的解锁状态
        this.updateSpecialIngredientsLock();
    }
    
    updateSpecialIngredientsLock() {
        const specialIngredients = document.querySelectorAll('.special-ingredient');
        
        specialIngredients.forEach(item => {
            const unlockScore = parseInt(item.dataset.unlockScore) || 0;
            const unlockHint = item.querySelector('.unlock-hint');
            
            if (this.score >= unlockScore) {
                // 已解锁
                item.classList.remove('locked');
                item.style.cursor = 'grab';
            } else {
                // 未解锁
                item.classList.add('locked');
                item.style.cursor = 'not-allowed';
                
                // 更新解锁提示
                if (unlockHint) {
                    unlockHint.textContent = `${unlockScore}分解锁`;
                }
            }
        });
    }
    
    showUnlockHint(unlockScore) {
        // 创建临时提示
        const hint = document.createElement('div');
        hint.className = 'unlock-hint-popup';
        hint.textContent = `需要达到 ${unlockScore} 分才能解锁这个食材！`;
        hint.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 1.2rem;
            font-weight: bold;
            z-index: 2000;
            animation: fadeInOut 2s ease-in-out forwards;
            pointer-events: none;
        `;
        
        document.body.appendChild(hint);
        
        // 添加CSS动画
        if (!document.querySelector('#unlock-hint-animations')) {
            const style = document.createElement('style');
            style.id = 'unlock-hint-animations';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // 2秒后移除
        setTimeout(() => {
            hint.remove();
        }, 2000);
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pause-btn').textContent = '继续';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pause-btn').textContent = '暂停';
            this.gameLoop();
        }
    }
    
    restartGame() {
        // 停止当前游戏
        if (this.runner) {
            this.Runner.stop(this.runner);
        }
        if (this.render) {
            this.Render.stop(this.render);
        }
        
        // 重置物理世界
        this.initPhysics();
        
        // 开始新游戏
        this.startGame();
    }
    
    endGame(reason) {
        if (this.gameState === 'gameover') return;
        
        this.gameState = 'gameover';
        
        // 触发倒塌反馈效果
        this.triggerCollapseFeedback(reason);
        
        // 停止引擎和渲染
        if (this.runner) {
            this.Runner.stop(this.runner);
        }
        if (this.render) {
            this.Render.stop(this.render);
        }
        
        // 清除订单计时器
        if (this.orderTimer) {
            clearTimeout(this.orderTimer);
            this.orderTimer = null;
        }
        
        // 隐藏订单
        document.getElementById('customer-order').classList.add('hidden');
        
        // 显示游戏结束画面（延迟一点让倒塌效果先展示）
        setTimeout(() => {
            document.getElementById('game-over-title').textContent = '游戏结束';
            document.getElementById('game-over-reason').textContent = reason;
            document.getElementById('final-score').textContent = this.score;
            document.getElementById('final-height').textContent = Math.round(this.maxHeight);
            document.getElementById('game-over').classList.remove('hidden');
            
            // 隐藏控制按钮
            document.getElementById('start-btn').classList.remove('hidden');
            document.getElementById('pause-btn').classList.add('hidden');
            document.getElementById('restart-btn').classList.add('hidden');
        }, 500);
    }
    
    triggerCollapseFeedback(reason) {
        // 激活倒塌效果
        this.collapseEffects.active = true;
        this.collapseEffects.startTime = Date.now();
        
        // 对所有食材施加倒塌效果
        this.ingredients.forEach(ing => {
            if (!ing.body) return;
            
            const config = ing.config;
            const body = ing.body;
            
            // 根据食材属性产生不同物理效果
            switch (config.shape) {
                case 'circle':
                case 'oval':
                    // 圆形食材滚动
                    const rollDirection = Math.random() > 0.5 ? 1 : -1;
                    this.Body.setAngularVelocity(body, rollDirection * (2 + Math.random() * 3));
                    this.Body.setVelocity(body, {
                        x: rollDirection * (3 + Math.random() * 5),
                        y: -2
                    });
                    break;
                    
                case 'liquid':
                    // 液体四溅
                    this.createLiquidSplash(
                        body.position.x,
                        body.position.y,
                        config.splashRadius || 50
                    );
                    break;
                    
                default:
                    // 其他食材随机飞散
                    const spreadX = (Math.random() - 0.5) * 10;
                    const spreadY = -(3 + Math.random() * 5);
                    this.Body.setVelocity(body, { x: spreadX, y: spreadY });
                    this.Body.setAngularVelocity(body, (Math.random() - 0.5) * 5);
                    break;
            }
        });
        
        // 屏幕震动效果
        this.triggerScreenShake();
        
        // 播放倒塌音效（模拟）
        this.playCollapseSound();
    }
    
    triggerScreenShake() {
        const container = document.getElementById('canvas-container');
        let shakeCount = 0;
        const maxShakes = 20;
        
        const shakeInterval = setInterval(() => {
            if (shakeCount >= maxShakes) {
                clearInterval(shakeInterval);
                container.style.transform = '';
                return;
            }
            
            const intensity = (maxShakes - shakeCount) / maxShakes * 10;
            const x = (Math.random() - 0.5) * intensity;
            const y = (Math.random() - 0.5) * intensity;
            
            container.style.transform = `translate(${x}px, ${y}px)`;
            shakeCount++;
        }, 50);
    }
    
    playCollapseSound() {
        // 这里可以添加实际的音效播放
        // 目前通过控制台模拟
        console.log('🔊 轰隆！汉堡倒塌了！');
    }
    
    handleResize() {
        if (!this.canvasContainer || !this.canvas) return;
        
        const rect = this.canvasContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // 更新画布尺寸
        this.canvas.width = width;
        this.canvas.height = height;
        
        // 注意：这里简化处理，实际游戏中可能需要重新定位所有物理体
    }
}

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new BurgerGame();
});
