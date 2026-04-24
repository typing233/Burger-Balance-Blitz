// 汉堡堆叠大师游戏主逻辑 - 多台面版
class BaseStation {
    constructor(game, stationId, name, offsetX = 0) {
        this.game = game;
        this.stationId = stationId;
        this.name = name;
        this.offsetX = offsetX;
        this.active = stationId === 0;
        this.unlocked = stationId < 2;
        this.unlockScore = stationId === 2 ? 500 : 0;
        
        // 台面状态
        this.score = 0;
        this.multiplier = 1.0;
        this.maxHeight = 0;
        this.currentHeight = 0;
        this.ingredients = [];
        this.baseBun = null;
        
        // 重心偏移检测
        this.centerOfMass = { x: 0, y: 0 };
        this.tiltStartTime = null;
        this.maxTiltAngle = 45 * (Math.PI / 180);
        this.tiltDuration = 2000;
        
        // 顾客订单
        this.currentOrder = null;
        this.customerAngry = false;
        
        // 羁绊和配方
        this.activeSynergies = new Set();
        this.completedRecipes = new Set();
        
        // 物理效果
        this.environmentEffects = {
            wind: { active: false, direction: 0, intensity: 0 },
            earthquake: { active: false, intensity: 0, duration: 0, startTime: 0 }
        };
        
        // 特殊食材效果
        this.jellyWobbleTime = 0;
        this.liquidParticles = [];
        
        // 倒塌反馈
        this.collapseEffects = {
            active: false,
            startTime: 0,
            duration: 2000
        };
        
        // 羁绊效果临时状态
        this.synergyEffects = {
            frictionModifier: 1.0,
            multiplierBonus: 0,
            shakeIntensity: 0
        };
    }
    
    createBaseBun(canvasWidth, canvasHeight) {
        const bunWidth = 150;
        const bunHeight = 40;
        const bunY = canvasHeight - 60;
        const centerX = canvasWidth / 2 + this.offsetX;
        
        this.baseBun = this.game.Bodies.rectangle(centerX, bunY, bunWidth, bunHeight, {
            isStatic: true,
            label: `baseBun_${this.stationId}`,
            render: {
                fillStyle: this.active ? '#DEB887' : '#A0A0A0',
                strokeStyle: this.active ? '#D2691E' : '#808080',
                lineWidth: 3
            },
            chamfer: {
                radius: [20, 20, 5, 5]
            }
        });
        
        this.game.World.add(this.game.world, this.baseBun);
    }
    
    activate() {
        this.active = true;
        if (this.baseBun) {
            this.baseBun.render.fillStyle = '#DEB887';
            this.baseBun.render.strokeStyle = '#D2691E';
        }
    }
    
    deactivate() {
        this.active = false;
        if (this.baseBun) {
            this.baseBun.render.fillStyle = '#A0A0A0';
            this.baseBun.render.strokeStyle = '#808080';
        }
    }
    
    unlock() {
        this.unlocked = true;
    }
    
    reset() {
        this.score = 0;
        this.multiplier = 1.0;
        this.maxHeight = 0;
        this.currentHeight = 0;
        this.tiltStartTime = null;
        this.currentOrder = null;
        this.customerAngry = false;
        this.activeSynergies.clear();
        this.completedRecipes.clear();
        this.jellyWobbleTime = 0;
        this.collapseEffects.active = false;
        
        this.environmentEffects.wind.active = false;
        this.environmentEffects.earthquake.active = false;
        
        this.synergyEffects = {
            frictionModifier: 1.0,
            multiplierBonus: 0,
            shakeIntensity: 0
        };
        
        if (this.ingredients.length > 0) {
            this.ingredients.forEach(ing => {
                if (ing.body) {
                    this.game.World.remove(this.game.world, ing.body);
                }
            });
            this.ingredients = [];
        }
    }
}

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
        this.gameState = 'idle';
        this.totalScore = 0;
        this.timeLeft = 180;
        this.totalMaxHeight = 0;
        
        // 物理引擎相关
        this.engine = null;
        this.render = null;
        this.runner = null;
        this.world = null;
        this.canvas = null;
        this.canvasContainer = null;
        
        // 多台面系统
        this.stations = [];
        this.currentStationId = 0;
        this.maxStations = 3;
        
        // 拖拽相关
        this.draggedIngredient = null;
        this.isDragging = false;
        this.dragTargetStation = null;
        
        // 全局计时器
        this.timerInterval = null;
        this.environmentTimer = null;
        this.orderTimer = null;
        
        // 食材配置
        this.ingredientConfig = this.createIngredientConfig();
        
        // 配方系统
        this.recipes = this.createRecipes();
        this.unlockedRecipes = new Set();
        
        // 羁绊系统
        this.synergies = this.createSynergies();
        this.totalActiveSynergies = 0;
        
        // 顾客订单模板（基础模板）
        this.baseOrderTemplates = [
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
    
    createIngredientConfig() {
        return {
            lettuce: {
                name: '生菜',
                emoji: '🥬',
                width: 120,
                height: 30,
                mass: 0.5,
                restitution: 0.8,
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
                friction: 0.02,
                color: '#FFEB3B',
                shape: 'rectangle',
                points: 15
            },
            patty: {
                name: '肉饼',
                emoji: '🍖',
                width: 110,
                height: 40,
                mass: 2.0,
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
                friction: 0.1,
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
            hotsauce: {
                name: '辣椒酱',
                emoji: '🌶️',
                width: 90,
                height: 20,
                mass: 0.3,
                restitution: 0.2,
                friction: 0.05,
                frictionAir: 0.08,
                color: '#D32F2F',
                shape: 'rectangle',
                points: 20,
                special: 'spicy',
                minScoreForUnlock: 100,
                synergyTrigger: true
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
            mushroom: {
                name: '蘑菇',
                emoji: '🍄',
                width: 80,
                height: 50,
                mass: 0.4,
                restitution: 0.7,
                friction: 0.15,
                color: '#8D6E63',
                shape: 'rectangle',
                points: 18,
                special: 'bouncy',
                minScoreForUnlock: 400,
                synergyTrigger: true
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
    }
    
    createRecipes() {
        return [
            {
                id: 'classic_burger',
                name: '经典汉堡',
                emoji: '🍔',
                ingredients: ['patty', 'cheese', 'lettuce', 'tomato'],
                description: '肉饼+奶酪+生菜+番茄的完美组合',
                effect: '解锁后该台面倍率永久+0.5',
                multiplierBonus: 0.5,
                unlocked: true,
                completed: false
            },
            {
                id: 'spicy_deluxe',
                name: '辣味豪华堡',
                emoji: '🌶️',
                ingredients: ['patty', 'cheese', 'hotsauce', 'onion', 'tomato'],
                description: '肉饼+奶酪+辣椒酱+洋葱+番茄',
                effect: '解锁高倍率辣味订单（x3倍）',
                orderMultiplier: 3.0,
                unlocked: false,
                unlockCondition: '达到200分解锁',
                unlockScore: 200
            },
            {
                id: 'breakfast_special',
                name: '早餐特供',
                emoji: '🍳',
                ingredients: ['patty', 'egg', 'cheese', 'bacon'],
                description: '肉饼+煎蛋+奶酪+培根',
                effect: '羁绊触发几率提升50%',
                synergyBoost: 0.5,
                unlocked: false,
                unlockCondition: '达到400分解锁',
                unlockScore: 400
            },
            {
                id: 'veggie_delight',
                name: '素汉堡',
                emoji: '🥬',
                ingredients: ['lettuce', 'tomato', 'onion', 'cheese', 'mushroom'],
                description: '生菜+番茄+洋葱+奶酪+蘑菇',
                effect: '所有蔬菜类食材摩擦力+50%',
                veggieFrictionBoost: 0.5,
                unlocked: false,
                unlockCondition: '达到600分解锁',
                unlockScore: 600
            },
            {
                id: 'mega_stack',
                name: '巨型堆叠',
                emoji: '🏗️',
                ingredients: ['patty', 'patty', 'patty', 'cheese', 'cheese', 'lettuce', 'tomato'],
                description: '三层肉饼+双层奶酪的豪华堆叠',
                effect: '解锁传说级订单（x5倍）',
                legendaryOrder: true,
                unlocked: false,
                unlockCondition: '达到1000分解锁',
                unlockScore: 1000
            }
        ];
    }
    
    createSynergies() {
        return [
            {
                id: 'cheese_melt',
                name: '奶酪融化',
                emoji: '🧀🔥',
                ingredients: ['cheese', 'patty'],
                description: '奶酪加热肉饼',
                effect: '两者之间摩擦力-30%，更易滑动',
                effectType: 'friction_reduce',
                frictionModifier: 0.7,
                color: '#FFD700'
            },
            {
                id: 'spicy_blast',
                name: '火辣爆发',
                emoji: '🌶️💥',
                ingredients: ['hotsauce', 'patty', 'onion'],
                description: '辣椒酱+肉饼+洋葱的火爆组合',
                effect: '触发全局小幅震动，倍率+0.3',
                effectType: 'shake_multiplier',
                shakeIntensity: 0.5,
                multiplierBonus: 0.3,
                color: '#FF4500'
            },
            {
                id: 'fresh_crunch',
                name: '新鲜爽脆',
                emoji: '🥬🍅',
                ingredients: ['lettuce', 'tomato'],
                description: '生菜配番茄的新鲜组合',
                effect: '两者稳定性提升，摩擦力+40%',
                effectType: 'friction_boost',
                frictionModifier: 1.4,
                color: '#32CD32'
            },
            {
                id: 'bacon_love',
                name: '培根之恋',
                emoji: '🥓🧀',
                ingredients: ['bacon', 'cheese'],
                description: '培根与奶酪的经典搭配',
                effect: '所有食材弹性+20%，得分倍率+0.2',
                effectType: 'bounce_multiplier',
                restitutionBoost: 1.2,
                multiplierBonus: 0.2,
                color: '#FF6347'
            },
            {
                id: 'mushroom_magic',
                name: '蘑菇魔法',
                emoji: '🍄✨',
                ingredients: ['mushroom', 'cheese', 'onion'],
                description: '蘑菇+奶酪+洋葱的神奇组合',
                effect: '全局震动效果，羁绊触发率+30%',
                effectType: 'global_shake',
                shakeIntensity: 0.8,
                synergyBoost: 0.3,
                color: '#9370DB'
            },
            {
                id: 'egg_slide',
                name: '滑蛋危机',
                emoji: '🍳⚠️',
                ingredients: ['egg', 'cheese'],
                description: '煎蛋加奶酪的危险组合',
                effect: '摩擦力-50%，但完成时获得双倍得分',
                effectType: 'risk_reward',
                frictionModifier: 0.5,
                scoreMultiplier: 2.0,
                color: '#FFD700'
            },
            {
                id: 'veggie_stack',
                name: '蔬菜堆叠',
                emoji: '🥬🧅🍄',
                ingredients: ['lettuce', 'onion', 'mushroom'],
                description: '三种蔬菜的健康组合',
                effect: '重心稳定性大幅提升，倾斜容忍+20%',
                effectType: 'stability_boost',
                tiltToleranceBoost: 1.2,
                color: '#228B22'
            },
            {
                id: 'triple_meat',
                name: '三重肉欲',
                emoji: '🍖🍖🍖',
                ingredients: ['patty', 'bacon', 'patty'],
                description: '肉饼+培根+肉饼的豪华肉组合',
                effect: '全局倍率+1.0，但重心偏移检测更敏感',
                effectType: 'high_risk_high_reward',
                multiplierBonus: 1.0,
                tiltSensitivityBoost: 1.5,
                color: '#8B0000'
            }
        ];
    }
    
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.canvasContainer = document.getElementById('canvas-container');
        this.bindEvents();
        this.initPhysics();
        this.initStations();
        this.renderRecipes();
    }
    
    initPhysics() {
        this.engine = this.Engine.create();
        this.world = this.engine.world;
        this.world.gravity.y = 1.0;
        
        const rect = this.canvasContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        this.canvas.width = width;
        this.canvas.height = height;
        
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
        
        this.createBoundaries(width, height);
    }
    
    initStations() {
        const stationNames = ['一号台', '二号台', '三号台'];
        const offsets = [0, 300, -300];
        
        for (let i = 0; i < this.maxStations; i++) {
            const station = new BaseStation(
                this,
                i,
                stationNames[i],
                offsets[i]
            );
            this.stations.push(station);
        }
    }
    
    createBoundaries(width, height) {
        const boundaryOptions = {
            isStatic: true,
            render: {
                visible: false
            }
        };
        
        const ground = this.Bodies.rectangle(width / 2, height + 50, width, 100, boundaryOptions);
        ground.label = 'ground';
        
        const leftWall = this.Bodies.rectangle(-50, height / 2, 100, height * 2, boundaryOptions);
        leftWall.label = 'wall';
        
        const rightWall = this.Bodies.rectangle(width + 50, height / 2, 100, height * 2, boundaryOptions);
        rightWall.label = 'wall';
        
        this.World.add(this.world, [ground, leftWall, rightWall]);
    }
    
    bindEvents() {
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const restartBtn = document.getElementById('restart-btn');
        const playAgainBtn = document.getElementById('play-again-btn');
        const toggleRecipesBtn = document.getElementById('toggle-recipes');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startGame();
            });
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
        
        if (toggleRecipesBtn) {
            toggleRecipesBtn.addEventListener('click', () => this.toggleRecipesPanel());
        }
        
        const stationTabs = document.querySelectorAll('.station-tab');
        stationTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const stationId = parseInt(tab.dataset.station);
                this.switchStation(stationId);
            });
        });
        
        const ingredientItems = document.querySelectorAll('.ingredient-item');
        
        ingredientItems.forEach((item, index) => {
            item.addEventListener('mousedown', (e) => {
                this.startIngredientDrag(e, item);
            });
            
            item.addEventListener('touchstart', (e) => {
                this.startIngredientDrag(e, item);
            }, { passive: false });
        });
        
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('touchmove', (e) => this.onMouseMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.onMouseUp(e));
        
        window.addEventListener('resize', () => this.handleResize());
    }
    
    switchStation(stationId) {
        const station = this.stations[stationId];
        if (!station.unlocked) {
            this.showUnlockHint(station.unlockScore);
            return;
        }
        
        if (this.currentStationId === stationId) return;
        
        this.stations[this.currentStationId].deactivate();
        this.currentStationId = stationId;
        station.activate();
        
        this.updateStationTabs();
        this.updateCenterOfMassIndicators();
    }
    
    updateStationTabs() {
        const tabs = document.querySelectorAll('.station-tab');
        tabs.forEach(tab => {
            const stationId = parseInt(tab.dataset.station);
            const station = this.stations[stationId];
            
            if (stationId === this.currentStationId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
            
            if (station.unlocked) {
                tab.classList.remove('locked');
                const scoreEl = tab.querySelector('.station-score');
                if (scoreEl) scoreEl.textContent = station.score;
                const emojiEl = tab.querySelector('.station-emoji');
                if (emojiEl) emojiEl.textContent = '🍽️';
            } else {
                tab.classList.add('locked');
            }
        });
    }
    
    startIngredientDrag(e, item) {
        if (this.gameState !== 'playing') {
            return;
        }
        
        if (item.classList.contains('special-ingredient') && item.classList.contains('locked')) {
            const unlockScore = parseInt(item.dataset.unlockScore) || 0;
            this.showUnlockHint(unlockScore);
            return;
        }
        
        if (e.type === 'touchstart') {
            e.preventDefault();
        }
        
        const ingredientType = item.dataset.type;
        const config = this.ingredientConfig[ingredientType];
        
        if (!config) return;
        
        const indicator = document.getElementById('dragging-indicator');
        const icon = document.getElementById('dragging-icon');
        icon.textContent = config.emoji;
        indicator.classList.remove('hidden');
        
        this.isDragging = true;
        this.draggedIngredient = {
            type: ingredientType,
            config: config,
            startX: e.clientX || (e.touches && e.touches[0].clientX),
            startY: e.clientY || (e.touches && e.touches[0].clientY)
        };
        
        this.updateDragIndicator(e);
    }
    
    onMouseMove(e) {
        if (!this.isDragging) return;
        this.updateDragIndicator(e);
        this.checkDragTargetStation(e);
    }
    
    checkDragTargetStation(e) {
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
        
        if (x === undefined) return;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasX = x - canvasRect.left;
        const canvasWidth = this.canvas.width;
        const centerX = canvasWidth / 2;
        
        let targetStation = null;
        let stationName = '';
        
        const stationZones = [
            { id: 0, minX: centerX - 200, maxX: centerX + 200, name: '一号台' },
            { id: 1, minX: centerX + 150, maxX: canvasWidth + 100, name: '二号台' },
            { id: 2, minX: -100, maxX: centerX - 150, name: '三号台' }
        ];
        
        for (const zone of stationZones) {
            if (canvasX >= zone.minX && canvasX <= zone.maxX) {
                const station = this.stations[zone.id];
                if (station && station.unlocked) {
                    targetStation = zone.id;
                    stationName = zone.name;
                }
                break;
            }
        }
        
        const dropIndicator = document.getElementById('station-drop-indicator');
        const dropNameEl = document.getElementById('drop-station-name');
        
        if (targetStation !== null && targetStation !== this.dragTargetStation) {
            this.dragTargetStation = targetStation;
            if (dropNameEl) dropNameEl.textContent = `释放到 ${stationName}`;
            dropIndicator.classList.remove('hidden');
        } else if (targetStation === null) {
            this.dragTargetStation = null;
            dropIndicator.classList.add('hidden');
        }
    }
    
    updateDragIndicator(e) {
        const indicator = document.getElementById('dragging-indicator');
        
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
        if (!this.isDragging || !this.draggedIngredient) {
            this.isDragging = false;
            return;
        }
        
        if (e.type === 'touchend') {
            e.preventDefault();
        }
        
        const indicator = document.getElementById('dragging-indicator');
        indicator.classList.add('hidden');
        
        const dropIndicator = document.getElementById('station-drop-indicator');
        dropIndicator.classList.add('hidden');
        
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
        
        if (x === undefined || y === undefined) {
            this.isDragging = false;
            this.draggedIngredient = null;
            return;
        }
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasX = x - canvasRect.left;
        const canvasY = y - canvasRect.top;
        
        let targetStationId = this.dragTargetStation !== null ? this.dragTargetStation : this.currentStationId;
        const targetStation = this.stations[targetStationId];
        
        if (!targetStation || !targetStation.unlocked) {
            this.isDragging = false;
            this.draggedIngredient = null;
            return;
        }
        
        if (canvasX >= 0 && canvasX <= this.canvas.width && 
            canvasY >= 0 && canvasY <= this.canvas.height) {
            
            const adjustedX = canvasX - targetStation.offsetX;
            this.createIngredient(targetStationId, this.draggedIngredient.type, adjustedX, canvasY);
        }
        
        this.isDragging = false;
        this.draggedIngredient = null;
        this.dragTargetStation = null;
    }
    
    createIngredient(stationId, type, x, y) {
        const station = this.stations[stationId];
        if (!station) return null;
        
        const config = this.ingredientConfig[type];
        if (!config) return null;
        
        const adjustedX = x + station.offsetX;
        
        let body;
        let friction = config.friction * station.synergyEffects.frictionModifier;
        
        switch (config.shape) {
            case 'circle':
                body = this.Bodies.circle(adjustedX, y, config.radius, {
                    label: `ingredient_${type}_${stationId}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    }
                });
                break;
                
            case 'ring':
                body = this.Bodies.circle(adjustedX, y, config.outerRadius, {
                    label: `ingredient_${type}_${stationId}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    }
                });
                break;
                
            case 'oval':
                body = this.Bodies.circle(adjustedX, y, config.radius, {
                    label: `ingredient_${type}_${stationId}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    }
                });
                break;
                
            case 'irregular':
                body = this.Bodies.rectangle(adjustedX, y, config.width, config.height, {
                    label: `ingredient_${type}_${stationId}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: friction,
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
                body = this.Bodies.rectangle(adjustedX, y, config.width, config.height, {
                    label: `ingredient_${type}_${stationId}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: friction,
                    frictionAir: config.frictionAir || 0.01,
                    render: {
                        fillStyle: config.color,
                        strokeStyle: this.darkenColor(config.color, 20),
                        lineWidth: 2
                    }
                });
                break;
                
            default:
                body = this.Bodies.rectangle(adjustedX, y, config.width, config.height, {
                    label: `ingredient_${type}_${stationId}`,
                    mass: config.mass,
                    restitution: config.restitution,
                    friction: friction,
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
        
        this.World.add(this.world, body);
        
        const ingredient = {
            body: body,
            type: type,
            config: config,
            stationId: stationId,
            added: Date.now(),
            specialEffects: {
                wobblePhase: Math.random() * Math.PI * 2,
                lastSlipTime: 0
            }
        };
        
        station.ingredients.push(ingredient);
        this.applySpecialIngredientEffects(station, ingredient);
        
        return body;
    }
    
    applySpecialIngredientEffects(station, ingredient) {
        const config = ingredient.config;
        if (!config.special) return;
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
        
        this.resetGame();
        this.gameState = 'playing';
        
        const rect = this.canvasContainer.getBoundingClientRect();
        for (const station of this.stations) {
            if (station.unlocked) {
                station.createBaseBun(rect.width, rect.height);
            }
        }
        
        this.Render.run(this.render);
        this.runner = this.Runner.create();
        this.Runner.run(this.runner, this.engine);
        
        this.gameLoop();
        this.startTimer();
        this.startOrderSystem();
        this.startEnvironmentSystem();
        
        this.updateUI();
        
        document.getElementById('start-btn').classList.add('hidden');
        document.getElementById('pause-btn').classList.remove('hidden');
        document.getElementById('restart-btn').classList.remove('hidden');
    }
    
    resetGame() {
        this.totalScore = 0;
        this.timeLeft = 180;
        this.totalMaxHeight = 0;
        this.totalActiveSynergies = 0;
        this.currentStationId = 0;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.environmentTimer) {
            clearInterval(this.environmentTimer);
            this.environmentTimer = null;
        }
        if (this.orderTimer) {
            clearTimeout(this.orderTimer);
            this.orderTimer = null;
        }
        
        for (const station of this.stations) {
            station.reset();
        }
        
        this.unlockedRecipes.clear();
        for (const recipe of this.recipes) {
            recipe.completed = false;
            if (recipe.unlockScore) {
                recipe.unlocked = false;
            }
        }
        
        this.stations[0].unlocked = true;
        this.stations[1].unlocked = true;
        this.stations[0].activate();
        this.stations[1].deactivate();
        if (this.stations[2]) {
            this.stations[2].unlocked = false;
            this.stations[2].deactivate();
        }
        
        document.getElementById('customer-order').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
        document.getElementById('synergy-effects').classList.add('hidden');
        
        this.updateStationTabs();
    }
    
    startEnvironmentSystem() {
        this.environmentTimer = setInterval(() => {
            if (this.gameState !== 'playing') return;
            
            if (Math.random() < 0.08) {
                const station = this.stations[this.currentStationId];
                if (station && station.active) {
                    if (Math.random() < 0.5) {
                        this.triggerWindEffect(station);
                    } else {
                        this.triggerEarthquakeEffect(station);
                    }
                }
            }
        }, 5000);
    }
    
    triggerWindEffect(station) {
        const duration = 5000 + Math.random() * 5000;
        const intensity = 0.5 + Math.random() * 1.5;
        const direction = Math.random() > 0.5 ? 1 : -1;
        
        station.environmentEffects.wind = {
            active: true,
            intensity: intensity,
            direction: direction
        };
        
        this.showEnvironmentEffectAlert('🌬️ 大风来袭！注意保持平衡！');
        
        setTimeout(() => {
            station.environmentEffects.wind.active = false;
        }, duration);
    }
    
    triggerEarthquakeEffect(station) {
        const duration = 2000 + Math.random() * 3000;
        const intensity = 1.0 + Math.random() * 2.0;
        
        station.environmentEffects.earthquake = {
            active: true,
            intensity: intensity,
            duration: duration,
            startTime: Date.now()
        };
        
        this.showEnvironmentEffectAlert('🌋 地震！汉堡要倒了！');
    }
    
    showEnvironmentEffectAlert(message) {
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
        
        setTimeout(() => {
            alert.remove();
        }, 2000);
    }
    
    gameLoop() {
        if (this.gameState !== 'playing') return;
        
        for (const station of this.stations) {
            if (!station.active || !station.unlocked) continue;
            
            this.updateEnvironmentEffects(station);
            this.updateSpecialIngredientEffects(station);
            this.checkGameConditions(station);
            this.updateScoreAndHeight(station);
            this.calculateCenterOfMass(station);
            this.checkSynergies(station);
            this.updateCollapseEffects(station);
        }
        
        this.checkRecipeUnlocks();
        this.checkStationUnlocks();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updateEnvironmentEffects(station) {
        const now = Date.now();
        
        if (station.environmentEffects.wind.active) {
            const wind = station.environmentEffects.wind;
            const windForce = wind.intensity * wind.direction;
            
            station.ingredients.forEach(ing => {
                if (ing.body) {
                    this.Body.applyForce(ing.body, ing.body.position, {
                        x: windForce * 0.001 * ing.body.mass,
                        y: 0
                    });
                }
            });
        }
        
        if (station.environmentEffects.earthquake.active) {
            const quake = station.environmentEffects.earthquake;
            const quakeTime = now - quake.startTime;
            
            if (quakeTime < quake.duration) {
                const shakeX = (Math.random() - 0.5) * quake.intensity * 2;
                const shakeY = (Math.random() - 0.5) * quake.intensity * 2;
                
                station.ingredients.forEach(ing => {
                    if (ing.body) {
                        this.Body.applyForce(ing.body, ing.body.position, {
                            x: shakeX * 0.001 * ing.body.mass,
                            y: shakeY * 0.001 * ing.body.mass
                        });
                    }
                });
            } else {
                station.environmentEffects.earthquake.active = false;
            }
        }
    }
    
    updateSpecialIngredientEffects(station) {
        const now = Date.now();
        station.jellyWobbleTime += 0.05;
        
        station.ingredients.forEach(ing => {
            if (!ing.body || !ing.config.special) return;
            
            const config = ing.config;
            const body = ing.body;
            
            switch (config.special) {
                case 'jelly':
                    const wobble = Math.sin(station.jellyWobbleTime + ing.specialEffects.wobblePhase) * config.wobbleIntensity;
                    this.Body.setAngularVelocity(body, body.angularVelocity + wobble * 0.01);
                    
                    if (Math.random() < 0.01) {
                        const bounceForce = (Math.random() - 0.5) * 0.002;
                        this.Body.applyForce(body, body.position, {
                            x: bounceForce,
                            y: -Math.abs(bounceForce)
                        });
                    }
                    break;
                    
                case 'slippery':
                    const slipChance = config.slipChance;
                    const currentAngle = Math.abs(body.angle);
                    const adjustedSlipChance = slipChance * (1 + currentAngle * 2);
                    
                    if (Math.random() < adjustedSlipChance * 0.01) {
                        const slipDirection = Math.random() > 0.5 ? 1 : -1;
                        this.Body.applyForce(body, body.position, {
                            x: slipDirection * 0.005,
                            y: 0
                        });
                    }
                    break;
                    
                case 'rollable':
                    if (Math.abs(body.angularVelocity) < 0.5 && Math.random() < 0.005) {
                        const rollDirection = Math.random() > 0.5 ? 1 : -1;
                        this.Body.setAngularVelocity(body, body.angularVelocity + rollDirection * config.rollSpeed * 0.1);
                    }
                    break;
                    
                case 'liquid':
                    if (body.velocity.y > 5 && Math.random() < 0.1) {
                        this.createLiquidSplash(station, body.position.x, body.position.y, config.splashRadius);
                    }
                    break;
            }
        });
    }
    
    createLiquidSplash(station, x, y, radius) {
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
            
            this.Body.setVelocity(particle, {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed - 2
            });
            
            this.World.add(this.world, particle);
            
            station.liquidParticles.push({
                body: particle,
                createdAt: Date.now(),
                lifetime: 2000 + Math.random() * 1000
            });
        }
        
        this.cleanupLiquidParticles(station);
    }
    
    cleanupLiquidParticles(station) {
        const now = Date.now();
        
        for (let i = station.liquidParticles.length - 1; i >= 0; i--) {
            const particle = station.liquidParticles[i];
            
            if (now - particle.createdAt > particle.lifetime) {
                this.World.remove(this.world, particle.body);
                station.liquidParticles.splice(i, 1);
            }
        }
    }
    
    updateCollapseEffects(station) {
        if (!station.collapseEffects.active) return;
        
        const now = Date.now();
        const elapsed = now - station.collapseEffects.startTime;
        
        if (elapsed >= station.collapseEffects.duration) {
            station.collapseEffects.active = false;
        }
    }
    
    checkGameConditions(station) {
        this.checkFallenIngredients(station);
        this.checkTiltAngle(station);
    }
    
    checkFallenIngredients(station) {
        const canvasHeight = this.canvas.height;
        
        for (let i = station.ingredients.length - 1; i >= 0; i--) {
            const ing = station.ingredients[i];
            if (!ing.body) continue;
            
            if (ing.body.position.y > canvasHeight + 100) {
                this.endGame(`${station.name}有食材掉落到了桌面外！`);
                return;
            }
        }
    }
    
    checkTiltAngle(station) {
        if (station.ingredients.length < 2) return;
        
        const tiltAngle = this.calculateOverallTilt(station);
        const tiltTolerance = station.synergyEffects.tiltToleranceBoost || 1.0;
        const tiltSensitivity = station.synergyEffects.tiltSensitivityBoost || 1.0;
        
        const effectiveMaxTilt = station.maxTiltAngle * tiltTolerance / tiltSensitivity;
        
        if (Math.abs(tiltAngle) > effectiveMaxTilt) {
            if (!station.tiltStartTime) {
                station.tiltStartTime = Date.now();
            } else {
                const elapsed = Date.now() - station.tiltStartTime;
                if (elapsed >= station.tiltDuration) {
                    this.endGame(`${station.name}汉堡倾斜超过45度并持续了2秒！`);
                    return;
                }
            }
        } else {
            station.tiltStartTime = null;
        }
    }
    
    calculateOverallTilt(station) {
        if (station.ingredients.length === 0) return 0;
        
        let totalAngle = 0;
        let validCount = 0;
        
        station.ingredients.forEach(ing => {
            if (ing.body) {
                totalAngle += ing.body.angle;
                validCount++;
            }
        });
        
        if (validCount === 0) return 0;
        
        return totalAngle / validCount;
    }
    
    checkSynergies(station) {
        const scoredIngredients = station.ingredients.filter(ing => ing.scored);
        if (scoredIngredients.length < 2) return;
        
        const ingredientTypes = scoredIngredients.map(ing => ing.type);
        const newSynergies = new Set();
        
        for (const synergy of this.synergies) {
            const hasAllIngredients = synergy.ingredients.every(ing => 
                ingredientTypes.filter(t => t === ing).length >= 
                synergy.ingredients.filter(t => t === ing).length
            );
            
            if (hasAllIngredients) {
                if (!station.activeSynergies.has(synergy.id)) {
                    station.activeSynergies.add(synergy.id);
                    this.applySynergyEffect(station, synergy);
                    this.showSynergyPopup(synergy);
                }
                newSynergies.add(synergy.id);
            }
        }
        
        for (const synergyId of station.activeSynergies) {
            if (!newSynergies.has(synergyId)) {
                station.activeSynergies.delete(synergyId);
                const synergy = this.synergies.find(s => s.id === synergyId);
                if (synergy) {
                    this.removeSynergyEffect(station, synergy);
                }
            }
        }
        
        this.updateSynergyDisplay(station);
    }
    
    applySynergyEffect(station, synergy) {
        switch (synergy.effectType) {
            case 'friction_reduce':
            case 'friction_boost':
            case 'risk_reward':
                station.synergyEffects.frictionModifier *= synergy.frictionModifier || 1.0;
                break;
                
            case 'shake_multiplier':
            case 'bounce_multiplier':
            case 'high_risk_high_reward':
                station.synergyEffects.multiplierBonus += synergy.multiplierBonus || 0;
                if (synergy.shakeIntensity) {
                    station.synergyEffects.shakeIntensity += synergy.shakeIntensity;
                }
                break;
                
            case 'global_shake':
                station.synergyEffects.shakeIntensity += synergy.shakeIntensity || 0;
                break;
                
            case 'stability_boost':
                station.synergyEffects.tiltToleranceBoost = synergy.tiltToleranceBoost || 1.0;
                break;
        }
        
        if (synergy.shakeIntensity && synergy.shakeIntensity > 0) {
            this.triggerSynergyShake(station, synergy.shakeIntensity);
        }
    }
    
    removeSynergyEffect(station, synergy) {
        switch (synergy.effectType) {
            case 'friction_reduce':
            case 'friction_boost':
            case 'risk_reward':
                if (synergy.frictionModifier) {
                    station.synergyEffects.frictionModifier /= synergy.frictionModifier;
                }
                break;
                
            case 'shake_multiplier':
            case 'bounce_multiplier':
            case 'high_risk_high_reward':
                if (synergy.multiplierBonus) {
                    station.synergyEffects.multiplierBonus -= synergy.multiplierBonus;
                }
                if (synergy.shakeIntensity) {
                    station.synergyEffects.shakeIntensity -= synergy.shakeIntensity;
                }
                break;
                
            case 'global_shake':
                if (synergy.shakeIntensity) {
                    station.synergyEffects.shakeIntensity -= synergy.shakeIntensity;
                }
                break;
                
            case 'stability_boost':
                station.synergyEffects.tiltToleranceBoost = 1.0;
                break;
        }
    }
    
    triggerSynergyShake(station, intensity) {
        const container = document.getElementById('canvas-container');
        let shakeCount = 0;
        const maxShakes = Math.floor(10 * intensity);
        
        const shakeInterval = setInterval(() => {
            if (shakeCount >= maxShakes) {
                clearInterval(shakeInterval);
                container.style.transform = '';
                return;
            }
            
            const shakeIntensity = ((maxShakes - shakeCount) / maxShakes) * intensity * 5;
            const x = (Math.random() - 0.5) * shakeIntensity;
            const y = (Math.random() - 0.5) * shakeIntensity;
            
            container.style.transform = `translate(${x}px, ${y}px)`;
            shakeCount++;
        }, 50);
    }
    
    showSynergyPopup(synergy) {
        const popup = document.getElementById('synergy-popup');
        const titleEl = document.getElementById('synergy-popup-title');
        const nameEl = document.getElementById('synergy-popup-name');
        const effectEl = document.getElementById('synergy-popup-effect');
        
        if (titleEl) titleEl.textContent = `🔥 ${synergy.emoji}`;
        if (nameEl) nameEl.textContent = synergy.name;
        if (effectEl) effectEl.textContent = synergy.effect;
        
        popup.classList.remove('hidden');
        
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 2000);
    }
    
    updateSynergyDisplay(station) {
        const synergyEffectsEl = document.getElementById('synergy-effects');
        const synergyListEl = document.getElementById('synergy-list');
        const activeSynergiesEl = document.getElementById('active-synergies');
        
        if (station.activeSynergies.size > 0) {
            synergyEffectsEl.classList.remove('hidden');
            
            if (synergyListEl) {
                synergyListEl.innerHTML = '';
                station.activeSynergies.forEach(synergyId => {
                    const synergy = this.synergies.find(s => s.id === synergyId);
                    if (synergy) {
                        const item = document.createElement('div');
                        item.className = 'synergy-item';
                        item.innerHTML = `<span style="color: ${synergy.color}">${synergy.emoji} ${synergy.name}</span>`;
                        synergyListEl.appendChild(item);
                    }
                });
            }
        } else {
            synergyEffectsEl.classList.add('hidden');
        }
        
        if (activeSynergiesEl) {
            let totalActive = 0;
            for (const s of this.stations) {
                totalActive += s.activeSynergies.size;
            }
            activeSynergiesEl.textContent = totalActive;
            this.totalActiveSynergies = totalActive;
        }
    }
    
    checkRecipeUnlocks() {
        for (const recipe of this.recipes) {
            if (!recipe.unlocked && recipe.unlockScore && this.totalScore >= recipe.unlockScore) {
                recipe.unlocked = true;
                this.unlockedRecipes.add(recipe.id);
                this.showRecipeUnlockPopup(recipe);
            }
        }
        
        for (const station of this.stations) {
            if (!station.active) continue;
            
            const scoredIngredients = station.ingredients.filter(ing => ing.scored);
            const ingredientTypes = scoredIngredients.map(ing => ing.type);
            
            for (const recipe of this.recipes) {
                if (!recipe.unlocked || station.completedRecipes.has(recipe.id)) continue;
                
                const hasAllIngredients = recipe.ingredients.every(ing => 
                    ingredientTypes.filter(t => t === ing).length >= 
                    recipe.ingredients.filter(t => t === ing).length
                );
                
                if (hasAllIngredients) {
                    station.completedRecipes.add(recipe.id);
                    this.applyRecipeEffect(station, recipe);
                }
            }
        }
        
        this.renderRecipes();
    }
    
    applyRecipeEffect(station, recipe) {
        if (recipe.multiplierBonus) {
            station.multiplier += recipe.multiplierBonus;
        }
    }
    
    showRecipeUnlockPopup(recipe) {
        const popup = document.getElementById('recipe-unlock-popup');
        const nameEl = document.getElementById('unlock-recipe-name');
        const effectEl = document.getElementById('unlock-recipe-effect');
        
        if (nameEl) nameEl.textContent = `${recipe.emoji} ${recipe.name}`;
        if (effectEl) effectEl.textContent = recipe.effect;
        
        popup.classList.remove('hidden');
        
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 3000);
    }
    
    checkStationUnlocks() {
        for (const station of this.stations) {
            if (!station.unlocked && station.unlockScore && this.totalScore >= station.unlockScore) {
                station.unlock();
                
                const rect = this.canvasContainer.getBoundingClientRect();
                station.createBaseBun(rect.width, rect.height);
                
                this.showStationUnlockPopup(station);
            }
        }
        
        this.updateStationTabs();
    }
    
    showStationUnlockPopup(station) {
        const popup = document.getElementById('recipe-unlock-popup');
        const nameEl = document.getElementById('unlock-recipe-name');
        const effectEl = document.getElementById('unlock-recipe-effect');
        
        if (nameEl) nameEl.textContent = `🎊 ${station.name} 已解锁！`;
        if (effectEl) effectEl.textContent = '现在可以在多个台面同时经营汉堡了！';
        
        popup.classList.remove('hidden');
        
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 3000);
    }
    
    renderRecipes() {
        const recipesList = document.getElementById('recipes-list');
        if (!recipesList) return;
        
        recipesList.innerHTML = '';
        
        for (const recipe of this.recipes) {
            const item = document.createElement('div');
            item.className = `recipe-item ${!recipe.unlocked ? 'locked' : ''}`;
            
            const ingredientsHtml = recipe.ingredients.map(ing => {
                const config = this.ingredientConfig[ing];
                return config ? config.emoji : '❓';
            }).join(' + ');
            
            item.innerHTML = `
                <div class="recipe-header">
                    <span class="recipe-emoji">${recipe.emoji}</span>
                    <span class="recipe-name">${recipe.name}</span>
                    ${!recipe.unlocked ? `<span class="recipe-lock">🔒 ${recipe.unlockScore}分解锁</span>` : ''}
                </div>
                <div class="recipe-ingredients">${ingredientsHtml}</div>
                <div class="recipe-desc">${recipe.description}</div>
                <div class="recipe-effect">效果: ${recipe.effect}</div>
            `;
            
            recipesList.appendChild(item);
        }
    }
    
    toggleRecipesPanel() {
        const recipesList = document.getElementById('recipes-list');
        const toggleBtn = document.getElementById('toggle-recipes');
        
        if (recipesList.classList.contains('hidden')) {
            recipesList.classList.remove('hidden');
            if (toggleBtn) toggleBtn.textContent = '收起';
        } else {
            recipesList.classList.add('hidden');
            if (toggleBtn) toggleBtn.textContent = '展开';
        }
    }
    
    updateScoreAndHeight(station) {
        if (station.ingredients.length === 0) return;
        
        let minY = Infinity;
        
        station.ingredients.forEach(ing => {
            if (ing.body) {
                const bounds = ing.body.bounds;
                if (bounds.min.y < minY) {
                    minY = bounds.min.y;
                }
            }
        });
        
        if (!station.baseBun) return;
        
        const baseTopY = station.baseBun.bounds.min.y;
        station.currentHeight = Math.max(0, baseTopY - minY);
        station.maxHeight = Math.max(station.maxHeight, station.currentHeight);
        
        const heightBonus = 1.0 + Math.floor(station.currentHeight / 100) * 0.5;
        station.multiplier = heightBonus + station.synergyEffects.multiplierBonus;
        
        const now = Date.now();
        station.ingredients.forEach(ing => {
            if (!ing.scored && ing.added && (now - ing.added) > 1000) {
                const basePoints = ing.config.points;
                const finalPoints = Math.floor(basePoints * station.multiplier);
                station.score += finalPoints;
                this.totalScore += finalPoints;
                ing.scored = true;
                
                this.checkOrderCompletion(station, ing.type);
            }
        });
        
        this.totalMaxHeight = Math.max(this.totalMaxHeight, station.maxHeight);
        this.updateUI();
    }
    
    calculateCenterOfMass(station) {
        if (!station.baseBun || !station.baseBun.position) {
            this.updateCenterOfMassIndicator(station, 0);
            return;
        }
        
        station.centerOfMass = { 
            x: station.baseBun.position.x, 
            y: station.baseBun.position.y 
        };
        
        if (station.ingredients.length === 0) {
            this.updateCenterOfMassIndicator(station, 0);
            return;
        }
        
        let totalMass = 0;
        let weightedX = 0;
        let weightedY = 0;
        
        const baseMass = 10;
        totalMass += baseMass;
        weightedX += station.baseBun.position.x * baseMass;
        weightedY += station.baseBun.position.y * baseMass;
        
        station.ingredients.forEach(ing => {
            if (ing.body && ing.body.position) {
                const mass = ing.body.mass || 1;
                totalMass += mass;
                weightedX += ing.body.position.x * mass;
                weightedY += ing.body.position.y * mass;
            }
        });
        
        if (totalMass > 0 && isFinite(totalMass)) {
            station.centerOfMass = {
                x: weightedX / totalMass,
                y: weightedY / totalMass
            };
        }
        
        const baseCenterX = station.baseBun.position.x;
        let baseHalfWidth = 75;
        
        if (station.baseBun.bounds && 
            station.baseBun.bounds.max && 
            station.baseBun.bounds.min &&
            isFinite(station.baseBun.bounds.max.x) && 
            isFinite(station.baseBun.bounds.min.x)) {
            const baseFullWidth = station.baseBun.bounds.max.x - station.baseBun.bounds.min.x;
            if (baseFullWidth > 0) {
                baseHalfWidth = baseFullWidth / 2;
            }
        }
        
        let offsetPercent = 0;
        
        if (station.centerOfMass && isFinite(station.centerOfMass.x) && isFinite(baseCenterX) && baseHalfWidth > 0) {
            const offsetX = station.centerOfMass.x - baseCenterX;
            offsetPercent = (offsetX / baseHalfWidth) * 100;
            
            if (!isFinite(offsetPercent)) {
                offsetPercent = 0;
            }
        }
        
        this.updateCenterOfMassIndicator(station, offsetPercent);
    }
    
    updateCenterOfMassIndicator(station, offsetPercent) {
        if (station.stationId !== this.currentStationId) return;
        
        const indicatorBar = document.querySelector(`.indicator-bar[data-station="${station.stationId}"]`);
        const indicatorValue = document.querySelector(`.indicator-value[data-station="${station.stationId}"]`);
        
        let safePercent = 0;
        if (typeof offsetPercent === 'number' && isFinite(offsetPercent)) {
            safePercent = offsetPercent;
        }
        
        const clampedPercent = Math.max(-100, Math.min(100, safePercent));
        const positionPercent = 50 + (clampedPercent / 2);
        
        if (indicatorBar) {
            indicatorBar.style.left = positionPercent + '%';
        }
        
        if (indicatorValue) {
            indicatorValue.textContent = Math.round(Math.abs(clampedPercent)) + '%';
        }
        
        if (indicatorBar) {
            if (Math.abs(clampedPercent) > 70) {
                indicatorBar.style.background = '#F44336';
            } else if (Math.abs(clampedPercent) > 40) {
                indicatorBar.style.background = '#FF9800';
            } else {
                indicatorBar.style.background = '#333';
            }
        }
    }
    
    updateCenterOfMassIndicators() {
        const indicatorsContainer = document.getElementById('center-of-mass-indicators');
        if (!indicatorsContainer) return;
        
        indicatorsContainer.innerHTML = '';
        
        for (const station of this.stations) {
            if (!station.unlocked) continue;
            
            const indicatorDiv = document.createElement('div');
            indicatorDiv.className = `station-indicator ${station.stationId === this.currentStationId ? 'active' : ''}`;
            indicatorDiv.dataset.station = station.stationId;
            
            indicatorDiv.innerHTML = `
                <div class="indicator-label">${station.name}重心:</div>
                <div class="indicator-bar-container">
                    <div class="indicator-bar" data-station="${station.stationId}" style="left: 50%;"></div>
                </div>
                <div class="indicator-value" data-station="${station.stationId}">0%</div>
            `;
            
            indicatorsContainer.appendChild(indicatorDiv);
        }
    }
    
    updateUI() {
        const totalScoreEl = document.getElementById('total-score');
        const multiplierEl = document.getElementById('multiplier');
        const timerEl = document.getElementById('timer');
        const heightEl = document.getElementById('height');
        
        if (totalScoreEl) totalScoreEl.textContent = this.totalScore;
        
        const currentStation = this.stations[this.currentStationId];
        if (currentStation && multiplierEl) {
            multiplierEl.textContent = 'x' + currentStation.multiplier.toFixed(1);
        }
        
        if (timerEl) timerEl.textContent = this.timeLeft;
        
        if (heightEl) heightEl.textContent = Math.round(this.totalMaxHeight);
        
        this.updateSpecialIngredientsLock();
        this.updateStationTabs();
    }
    
    updateSpecialIngredientsLock() {
        const specialIngredients = document.querySelectorAll('.special-ingredient');
        
        specialIngredients.forEach(item => {
            const unlockScore = parseInt(item.dataset.unlockScore) || 0;
            const unlockHint = item.querySelector('.unlock-hint');
            
            if (this.totalScore >= unlockScore) {
                item.classList.remove('locked');
                item.style.cursor = 'grab';
            } else {
                item.classList.add('locked');
                item.style.cursor = 'not-allowed';
                
                if (unlockHint) {
                    unlockHint.textContent = `${unlockScore}分解锁`;
                }
            }
        });
    }
    
    showUnlockHint(unlockScore) {
        const hint = document.createElement('div');
        hint.className = 'unlock-hint-popup';
        hint.textContent = `需要达到 ${unlockScore} 分才能解锁！`;
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
        if (this.runner) {
            this.Runner.stop(this.runner);
        }
        if (this.render) {
            this.Render.stop(this.render);
        }
        
        if (this.world) {
            const allBodies = this.Composite.allBodies(this.world);
            allBodies.forEach(body => {
                if (body.label && (body.label.startsWith('ingredient_') || 
                    body.label.startsWith('baseBun_') || 
                    body.label === 'liquid_particle')) {
                    this.World.remove(this.world, body);
                }
            });
        }
        
        this.initPhysics();
        this.startGame();
    }
    
    endGame(reason) {
        if (this.gameState === 'gameover') return;
        
        this.gameState = 'gameover';
        
        for (const station of this.stations) {
            if (station.active) {
                this.triggerCollapseFeedback(station, reason);
            }
        }
        
        if (this.runner) {
            this.Runner.stop(this.runner);
        }
        if (this.render) {
            this.Render.stop(this.render);
        }
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.orderTimer) {
            clearTimeout(this.orderTimer);
            this.orderTimer = null;
        }
        
        document.getElementById('customer-order').classList.add('hidden');
        
        setTimeout(() => {
            document.getElementById('game-over-title').textContent = '游戏结束';
            document.getElementById('game-over-reason').textContent = reason;
            
            for (let i = 0; i < this.stations.length; i++) {
                const stationScoreEl = document.getElementById(`station-${i}-score`);
                if (stationScoreEl && this.stations[i]) {
                    stationScoreEl.textContent = this.stations[i].score;
                }
            }
            
            document.getElementById('final-score').textContent = this.totalScore;
            document.getElementById('final-height').textContent = Math.round(this.totalMaxHeight);
            document.getElementById('final-synergies').textContent = this.totalActiveSynergies;
            
            let totalRecipes = 0;
            for (const station of this.stations) {
                totalRecipes += station.completedRecipes.size;
            }
            document.getElementById('final-recipes').textContent = totalRecipes;
            
            document.getElementById('game-over').classList.remove('hidden');
            
            document.getElementById('start-btn').classList.remove('hidden');
            document.getElementById('pause-btn').classList.add('hidden');
            document.getElementById('restart-btn').classList.add('hidden');
        }, 500);
    }
    
    triggerCollapseFeedback(station, reason) {
        station.collapseEffects.active = true;
        station.collapseEffects.startTime = Date.now();
        
        station.ingredients.forEach(ing => {
            if (!ing.body) return;
            
            const config = ing.config;
            const body = ing.body;
            
            switch (config.shape) {
                case 'circle':
                case 'oval':
                    const rollDirection = Math.random() > 0.5 ? 1 : -1;
                    this.Body.setAngularVelocity(body, rollDirection * (2 + Math.random() * 3));
                    this.Body.setVelocity(body, {
                        x: rollDirection * (3 + Math.random() * 5),
                        y: -2
                    });
                    break;
                    
                case 'liquid':
                    this.createLiquidSplash(
                        station,
                        body.position.x,
                        body.position.y,
                        config.splashRadius || 50
                    );
                    break;
                    
                default:
                    const spreadX = (Math.random() - 0.5) * 10;
                    const spreadY = -(3 + Math.random() * 5);
                    this.Body.setVelocity(body, { x: spreadX, y: spreadY });
                    this.Body.setAngularVelocity(body, (Math.random() - 0.5) * 5);
                    break;
            }
        });
        
        this.triggerScreenShake();
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
        console.log('🔊 轰隆！汉堡倒塌了！');
    }
    
    handleResize() {
        if (!this.canvasContainer || !this.canvas) return;
        
        const rect = this.canvasContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        this.canvas.width = width;
        this.canvas.height = height;
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            if (this.gameState !== 'playing') {
                clearInterval(this.timerInterval);
                return;
            }
            
            this.timeLeft--;
            document.getElementById('timer').textContent = this.timeLeft;
            
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.endGame('时间耗尽！');
            }
        }, 1000);
    }
    
    startOrderSystem() {
        this.orderTimer = setTimeout(() => {
            this.generateNewOrder();
        }, 5000);
    }
    
    generateNewOrder() {
        if (this.gameState !== 'playing') return;
        
        const currentStation = this.stations[this.currentStationId];
        if (!currentStation) return;
        
        currentStation.customerAngry = false;
        
        let templates = [...this.baseOrderTemplates];
        
        for (const recipe of this.recipes) {
            if (recipe.unlocked && recipe.orderMultiplier) {
                templates.push({
                    text: `我要招牌 ${recipe.name}！`,
                    type: 'recipe',
                    recipeId: recipe.id,
                    ingredients: recipe.ingredients,
                    multiplier: recipe.orderMultiplier
                });
            }
        }
        
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        currentStation.currentOrder = {
            ...template,
            startTime: Date.now(),
            timeLimit: 30000
        };
        
        this.updateCustomerOrderDisplay(template.text, false);
        document.getElementById('customer-order').classList.remove('hidden');
        
        this.orderTimer = setTimeout(() => {
            if (currentStation.currentOrder && !currentStation.currentOrder.completed) {
                this.triggerCustomerAngry();
            }
        }, 30000);
        
        setTimeout(() => {
            if (currentStation.currentOrder && !currentStation.currentOrder.completed && this.gameState === 'playing') {
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
        const currentStation = this.stations[this.currentStationId];
        if (!currentStation || !currentStation.currentOrder || currentStation.currentOrder.completed) return;
        
        const warningText = '快点！我赶时间！';
        this.updateCustomerOrderDisplay(warningText, false);
        
        const customerEmoji = document.querySelector('.customer-emoji');
        if (customerEmoji) {
            customerEmoji.textContent = '😐';
        }
        
        const orderBubble = document.querySelector('.order-bubble');
        if (orderBubble) {
            orderBubble.style.animation = 'pulse 0.5s ease-in-out infinite';
        }
    }
    
    triggerCustomerAngry() {
        const currentStation = this.stations[this.currentStationId];
        if (!currentStation || !currentStation.currentOrder || currentStation.currentOrder.completed) return;
        
        currentStation.customerAngry = true;
        
        const angryText = '什么？让我等这么久！我不吃了！';
        this.updateCustomerOrderDisplay(angryText, true);
        
        this.totalScore = Math.max(0, this.totalScore - 100);
        currentStation.score = Math.max(0, currentStation.score - 100);
        this.updateUI();
        
        this.showAngryEffect();
        
        setTimeout(() => {
            document.getElementById('customer-order').classList.add('hidden');
            currentStation.currentOrder = null;
            currentStation.customerAngry = false;
            
            const orderBubble = document.querySelector('.order-bubble');
            if (orderBubble) {
                orderBubble.style.background = 'white';
                orderBubble.style.animation = '';
            }
            
            setTimeout(() => this.generateNewOrder(), 2000);
        }, 3000);
    }
    
    showAngryEffect() {
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
        
        setTimeout(() => {
            effect.remove();
        }, 1000);
    }
    
    checkOrderCompletion(station, ingredientType) {
        if (!station.currentOrder || station.currentOrder.completed) return;
        
        let completed = false;
        let bonusPoints = 0;
        const order = station.currentOrder;
        
        switch (order.type) {
            case 'specific':
                const count = station.ingredients.filter(ing => 
                    ing.type === order.ingredient && ing.scored
                ).length;
                
                if (count >= order.count) {
                    completed = true;
                    bonusPoints = 100;
                }
                break;
                
            case 'sequence':
                const types = station.ingredients.filter(ing => ing.scored).map(ing => ing.type);
                const hasAll = order.ingredients.every(type => types.includes(type));
                
                if (hasAll) {
                    completed = true;
                    bonusPoints = 150;
                }
                break;
                
            case 'top':
                const sortedByHeight = [...station.ingredients]
                    .filter(ing => ing.scored && ing.body)
                    .sort((a, b) => a.body.position.y - b.body.position.y);
                
                if (sortedByHeight.length > 0 && sortedByHeight[0].type === order.ingredient) {
                    completed = true;
                    bonusPoints = 120;
                }
                break;
                
            case 'recipe':
                const recipeIngredients = station.ingredients.filter(ing => ing.scored).map(ing => ing.type);
                const hasRecipeIngredients = order.ingredients.every(ing => 
                    recipeIngredients.filter(t => t === ing).length >= 
                    order.ingredients.filter(t => t === ing).length
                );
                
                if (hasRecipeIngredients) {
                    completed = true;
                    const multiplier = order.multiplier || 2.0;
                    bonusPoints = Math.floor(200 * multiplier);
                }
                break;
        }
        
        if (completed) {
            station.currentOrder.completed = true;
            station.score += bonusPoints;
            this.totalScore += bonusPoints;
            this.updateUI();
            
            setTimeout(() => {
                document.getElementById('customer-order').classList.add('hidden');
                station.currentOrder = null;
                
                setTimeout(() => this.generateNewOrder(), 5000);
            }, 2000);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BurgerGame();
});