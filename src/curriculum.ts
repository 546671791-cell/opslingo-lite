export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type StudyMethod = 'scene' | 'listen' | 'shadow' | 'dialogue';

export interface LevelProfile {
  id: CefrLevel;
  title: string;
  subtitle: string;
  color: string;
}

export interface CourseStep {
  level: CefrLevel;
  goal: string;
  phrase: string;
  meaning: string;
  note: string;
  challenge: string;
}

export interface LifeCourse {
  id: string;
  group: '刚落地' | '吃喝购物' | '健康办事' | '社交娱乐' | '周末旅行';
  title: string;
  titleEn: string;
  image: string;
  minutes: number;
  keywords: { term: string; meaning: string; phonetic: string }[];
  steps: CourseStep[];
  cultureTips: string[];
}

export const cefrLevels: LevelProfile[] = [
  { id: 'A1', title: '入门', subtitle: '生存表达', color: 'mint' },
  { id: 'A2', title: '基础', subtitle: '完整短句', color: 'sky' },
  { id: 'B1', title: '独立', subtitle: '处理日常', color: 'blue' },
  { id: 'B2', title: '进阶', subtitle: '自然沟通', color: 'violet' },
  { id: 'C1', title: '高阶', subtitle: '精准得体', color: 'orange' },
  { id: 'C2', title: '精通', subtitle: '灵活地道', color: 'charcoal' }
];

export const studyMethods: { id: StudyMethod; label: string; description: string }[] = [
  { id: 'scene', label: '场景精学', description: '先理解语境，再掌握可直接使用的表达。' },
  { id: 'listen', label: '五遍精听', description: '盲听、对照、慢听、跟读、复述五轮循环。' },
  { id: 'shadow', label: '影子跟读', description: '紧跟原声模仿重音、节奏与连读。' },
  { id: 'dialogue', label: '任务对话', description: '带着现实任务组织语言并完成交流。' }
];

const steps = (
  goals: string[],
  phrases: string[],
  meanings: string[],
  notes: string[],
  challenges: string[]
): CourseStep[] =>
  cefrLevels.map((level, index) => ({
    level: level.id,
    goal: goals[index],
    phrase: phrases[index],
    meaning: meanings[index],
    note: notes[index],
    challenge: challenges[index]
  }));

export const lifeCourses: LifeCourse[] = [
  {
    id: 'us-city-rideshare',
    group: '刚落地',
    title: '在美国城市打车',
    titleEn: 'Getting Around by Rideshare',
    image: 'images/courses/us-city-rideshare.jpg',
    minutes: 12,
    keywords: [
      { term: 'pickup point', meaning: '上车点', phonetic: '/ˈpɪkʌp pɔɪnt/' },
      { term: 'destination', meaning: '目的地', phonetic: '/ˌdestɪˈneɪʃn/' },
      { term: 'curb', meaning: '路缘；路边', phonetic: '/kɜːrb/' },
      { term: 'fare', meaning: '车费', phonetic: '/fer/' },
      { term: 'traffic', meaning: '交通；车流', phonetic: '/ˈtræfɪk/' },
      { term: 'drop off', meaning: '让乘客下车', phonetic: '/drɑːp ɔːf/' }
    ],
    steps: steps(
      [
        '找到司机并确认姓名',
        '说明准确上车位置',
        '处理路线或下车点变化',
        '礼貌协商等待和额外停靠',
        '解释复杂地点并降低误会',
        '自然处理含蓄请求与突发变化'
      ],
      [
        'Hi, are you here for Alex?',
        'I am by the north entrance, next to the blue sign.',
        'Could you drop me off on the other side of the street?',
        'Would you mind waiting two minutes while I pick up my friend?',
        'The entrance is easy to miss; it is just past the loading zone.',
        'If it is not too much trouble, could we avoid the tunnel and take the surface streets?'
      ],
      [
        '你好，你是来接 Alex 的吗？',
        '我在北门蓝色标志旁边。',
        '可以把我放在街道另一边吗？',
        '可以等两分钟让我接上朋友吗？',
        '入口很容易错过；就在装卸区前面一点。',
        '如果不太麻烦的话，我们可以避开隧道走地面道路吗？'
      ],
      [
        '用姓名核对车辆。',
        '用 by、next to 精确定位。',
        'drop me off 是自然下车表达。',
        'Would you mind 后接动名词。',
        '先提示风险，再说明位置。',
        '用缓和语让复杂请求更得体。'
      ],
      [
        '用一句话确认司机。',
        '描述你所在的门和标志物。',
        '临时更改一次下车位置。',
        '提出等待请求并说明原因。',
        '给出三步定位说明。',
        '在路线、时间和费用之间进行委婉协商。'
      ]
    ),
    cultureTips: [
      '上车前核对车牌和司机姓名。',
      '美国很多机场有单独的 rideshare pickup 区域。',
      '下车时简短说 Thank you, have a good one 很自然。'
    ]
  },
  {
    id: 'us-ordering-food',
    group: '吃喝购物',
    title: '在美国餐厅点餐',
    titleEn: 'Ordering Food with Confidence',
    image: 'images/courses/us-ordering-food.jpg',
    minutes: 14,
    keywords: [
      { term: 'entrée', meaning: '主菜（美式）', phonetic: '/ˈɑːntreɪ/' },
      { term: 'side', meaning: '配菜', phonetic: '/saɪd/' },
      { term: 'dressing', meaning: '沙拉酱', phonetic: '/ˈdresɪŋ/' },
      { term: 'refill', meaning: '续杯', phonetic: '/ˌriːˈfɪl/' },
      { term: 'check', meaning: '账单（美式）', phonetic: '/tʃek/' },
      { term: 'to go', meaning: '打包带走', phonetic: '/tə ɡoʊ/' }
    ],
    steps: steps(
      [
        '点一份简单餐食',
        '选择配菜和饮料',
        '说明忌口或过敏',
        '询问做法并进行替换',
        '礼貌处理出错的订单',
        '用自然语气协商特殊需求'
      ],
      [
        'I would like the chicken sandwich, please.',
        'Can I get a salad instead of fries?',
        'I have a nut allergy. Does this contain any nuts?',
        'Could I have the dressing on the side and the steak medium rare?',
        'I may have received the wrong order. Could you help me check?',
        'I know it is a bit specific, but would it be possible to leave the sauce off and add avocado?'
      ],
      [
        '我想要鸡肉三明治。',
        '可以把薯条换成沙拉吗？',
        '我对坚果过敏。这含坚果吗？',
        '沙拉酱可以另放，牛排做三分熟吗？',
        '我的餐点可能拿错了，可以帮我核对吗？',
        '我知道要求有点具体，可以不放酱并加牛油果吗？'
      ],
      [
        'I would like 比 I want 更礼貌。',
        'instead of 表示用一项替换另一项。',
        '严重过敏应直接说 allergy。',
        'on the side 表示分开放。',
        '先用 may 降低指责感。',
        '先承认请求复杂，再礼貌询问可行性。'
      ],
      [
        '完成一项点餐。',
        '做两项选择。',
        '清楚说明一种过敏。',
        '提出熟度与配料要求。',
        '在不指责服务员的情况下纠错。',
        '完成包含替换、加料和确认费用的订单。'
      ]
    ),
    cultureTips: [
      '美国餐厅的 entrée 通常指主菜。',
      'Could we get the check? 是自然的买单表达。',
      '过敏信息应明确，不要只说 I do not like…。'
    ]
  },
  {
    id: 'us-grocery-shopping',
    group: '吃喝购物',
    title: '在美国超市购物',
    titleEn: 'Everyday Grocery Shopping',
    image: 'images/courses/us-grocery-shopping.jpg',
    minutes: 13,
    keywords: [
      { term: 'aisle', meaning: '货架通道', phonetic: '/aɪl/' },
      { term: 'checkout', meaning: '收银台；结账', phonetic: '/ˈtʃekaʊt/' },
      { term: 'receipt', meaning: '收据', phonetic: '/rɪˈsiːt/' },
      { term: 'out of stock', meaning: '缺货', phonetic: '/aʊt əv stɑːk/' },
      { term: 'store credit', meaning: '商店购物金', phonetic: '/stɔːr ˈkredɪt/' },
      { term: 'price match', meaning: '同价匹配', phonetic: '/praɪs mætʃ/' }
    ],
    steps: steps(
      [
        '询问商品位置',
        '确认价格和数量',
        '在自助收银求助',
        '退换不合适的商品',
        '处理促销与价格差异',
        '在政策边界内理性协商'
      ],
      [
        'Excuse me, where can I find milk?',
        'Is this price for one item or for two?',
        'The machine is not scanning this item. Could you help me?',
        'I would like to return this. I have the receipt.',
        'The shelf label showed a lower price. Could you check it for me?',
        'I understand the policy; could you tell me whether store credit is an option?'
      ],
      [
        '请问牛奶在哪里？',
        '这个价格是一件还是两件？',
        '机器扫不出这个商品，可以帮我吗？',
        '我想退掉这个，我有收据。',
        '货架标签显示的价格更低，可以帮我核对吗？',
        '我理解规定；请问能否改为商店购物金？'
      ],
      [
        '先说 Excuse me 再提问。',
        'for one / for two 用于确认数量。',
        '说明机器的问题而非只说 help。',
        '退货时主动说明有无收据。',
        '陈述看到的事实，避免直接指责。',
        '先认可政策，再询问替代方案。'
      ],
      [
        '找到一种商品。',
        '确认一个促销标签。',
        '解决一次自助结账故障。',
        '完成退货并说明原因。',
        '核对价格且保持礼貌。',
        '协商退款、换货或购物金三种方案。'
      ]
    ),
    cultureTips: [
      'aisle 的 s 不发音。',
      '很多商店会问 Do you need a bag?。',
      '退换政策差异很大，保留 receipt 会更顺利。'
    ]
  },
  {
    id: 'us-healthcare',
    group: '健康办事',
    title: '在美国看病买药',
    titleEn: 'Clinic and Pharmacy English',
    image: 'images/courses/us-healthcare.jpg',
    minutes: 16,
    keywords: [
      { term: 'symptom', meaning: '症状', phonetic: '/ˈsɪmptəm/' },
      { term: 'appointment', meaning: '预约', phonetic: '/əˈpɔɪntmənt/' },
      { term: 'insurance', meaning: '保险', phonetic: '/ɪnˈʃʊrəns/' },
      { term: 'prescription', meaning: '处方', phonetic: '/prɪˈskrɪpʃn/' },
      { term: 'dosage', meaning: '剂量', phonetic: '/ˈdoʊsɪdʒ/' },
      { term: 'side effect', meaning: '副作用', phonetic: '/saɪd ɪˈfekt/' }
    ],
    steps: steps(
      [
        '说出最主要症状',
        '说明持续时间和程度',
        '预约并提供基本信息',
        '询问处方和用药方法',
        '准确描述症状变化与病史',
        '权衡治疗建议并确认风险'
      ],
      [
        'I have a sore throat.',
        'It started three days ago and is getting worse.',
        'I would like to make an appointment for this afternoon.',
        'How often should I take this, and are there any side effects?',
        'The pain comes and goes, but it becomes sharper after I eat.',
        'Could you walk me through the benefits, risks, and reasonable alternatives?'
      ],
      [
        '我喉咙痛。',
        '三天前开始，而且越来越严重。',
        '我想预约今天下午。',
        '这个多久服用一次，有副作用吗？',
        '疼痛时有时无，但进食后会更尖锐。',
        '可以为我说明益处、风险和合理替代方案吗？'
      ],
      [
        '先说核心症状。',
        'started…ago 描述起始时间。',
        'make an appointment 表示预约。',
        '确认频率和副作用。',
        '用具体变化帮助判断。',
        '高阶表达应精确但不要自行诊断。'
      ],
      [
        '说一个症状。',
        '补充时间和严重程度。',
        '完成电话预约。',
        '复述用药说明。',
        '用四个维度描述症状。',
        '就方案、风险和替代选择提出澄清问题。'
      ]
    ),
    cultureTips: [
      '紧急危险症状应联系当地急救服务，不依赖语言学习应用。',
      'urgent care 通常处理非危及生命但需要尽快就诊的问题。',
      '取药时确认 dosage、frequency 和 side effects。'
    ]
  },
  {
    id: 'us-social-life',
    group: '社交娱乐',
    title: '交朋友与参加活动',
    titleEn: 'Making Friends and Going Out',
    image: 'images/courses/us-social-life.jpg',
    minutes: 12,
    keywords: [
      { term: 'hang out', meaning: '一起玩；相处', phonetic: '/hæŋ aʊt/' },
      { term: 'get-together', meaning: '小聚会', phonetic: '/ˈɡet təɡeðər/' },
      { term: 'recommendation', meaning: '推荐', phonetic: '/ˌrekəmenˈdeɪʃn/' },
      { term: 'into', meaning: '对……感兴趣', phonetic: '/ˈɪntuː/' },
      { term: 'vibe', meaning: '氛围；感觉', phonetic: '/vaɪb/' },
      { term: 'catch up', meaning: '叙旧；聊近况', phonetic: '/kætʃ ʌp/' }
    ],
    steps: steps(
      [
        '自然自我介绍',
        '询问兴趣并延续话题',
        '发出或回应邀请',
        '表达不同意见而不冷场',
        '讲述经历并控制谈话节奏',
        '理解幽默、言外之意和社交边界'
      ],
      [
        'Hi, I am Mei. Nice to meet you.',
        'What do you like to do on weekends?',
        'A few of us are getting coffee later. Would you like to join?',
        'I can see why you like it, though it is not really my thing.',
        'That reminds me of something that happened when I first moved here.',
        'I may be reading too much into it, but was that meant as a joke?'
      ],
      [
        '你好，我叫 Mei。很高兴认识你。',
        '你周末喜欢做什么？',
        '我们几个人一会儿去喝咖啡，你想加入吗？',
        '我能理解你为什么喜欢，不过它不太适合我。',
        '这让我想起刚搬来时发生的一件事。',
        '也许我想多了，不过那句话是在开玩笑吗？'
      ],
      [
        '简短介绍后给对方回应空间。',
        '开放式问题更容易延续话题。',
        'a few of us 会降低邀请压力。',
        '先认可，再表达个人偏好。',
        '用过渡句自然接入故事。',
        '对含义不确定时直接但温和地确认。'
      ],
      [
        '完成姓名介绍。',
        '连续问两个开放问题。',
        '邀请对方参加一项活动。',
        '礼貌表达不同偏好。',
        '讲一个一分钟经历。',
        '处理玩笑、拒绝和边界感。'
      ]
    ),
    cultureTips: [
      'How are you? 常是简短问候，不一定期待详细回答。',
      '邀请中带具体时间和活动更容易得到明确回复。',
      '礼貌拒绝可以先感谢，再给简短理由。'
    ]
  },
  {
    id: 'us-weekend-travel',
    group: '周末旅行',
    title: '美国周末旅行',
    titleEn: 'A Weekend Trip and the Outdoors',
    image: 'images/courses/us-weekend-travel.jpg',
    minutes: 15,
    keywords: [
      { term: 'trailhead', meaning: '登山口；步道起点', phonetic: '/ˈtreɪlhed/' },
      { term: 'shuttle', meaning: '接驳车', phonetic: '/ˈʃʌtl/' },
      { term: 'permit', meaning: '许可证', phonetic: '/ˈpɜːrmɪt/' },
      { term: 'overlook', meaning: '观景台', phonetic: '/ˈoʊvərlʊk/' },
      { term: 'detour', meaning: '绕行路线', phonetic: '/ˈdiːtʊr/' },
      { term: 'strenuous', meaning: '费力的；高强度的', phonetic: '/ˈstrenjuəs/' }
    ],
    steps: steps(
      [
        '询问地点和开放时间',
        '确认路线与交通',
        '了解步道难度和装备',
        '处理天气或道路变化',
        '比较路线并说明个人能力',
        '综合安全、时间和体验作出判断'
      ],
      [
        'What time does the park open?',
        'Does the shuttle stop near the trailhead?',
        'How difficult is the trail, and do I need special equipment?',
        'Is there an alternative route because of the road closure?',
        'I am comfortable with steep sections, but I would rather avoid exposed ridges.',
        'Given the weather window, would you recommend a shorter route with more reliable access?'
      ],
      [
        '公园几点开放？',
        '接驳车停在步道起点附近吗？',
        '步道难度如何，需要特殊装备吗？',
        '道路封闭后有替代路线吗？',
        '我能应付陡坡，但希望避开暴露的山脊。',
        '考虑天气窗口，你会建议更短且通行更可靠的路线吗？'
      ],
      [
        '用 What time 询问时间。',
        'stop near 表示停靠在附近。',
        '同时确认难度和装备。',
        'because of 后接名词。',
        '准确说明能力和偏好。',
        '给出判断条件，让建议更有针对性。'
      ],
      [
        '问开放时间。',
        '规划接驳车与步道。',
        '向工作人员确认安全信息。',
        '为封路制定备选方案。',
        '比较两条路线。',
        '根据天气、体力、时间完成风险权衡。'
      ]
    ),
    cultureTips: [
      '国家公园旺季可能需要预约或 permit。',
      '不要只问 easy or hard，可询问距离、爬升和路面情况。',
      '天气和道路信息应以公园官方实时通知为准。'
    ]
  }
];

export const courseGroups = ['刚落地', '吃喝购物', '健康办事', '社交娱乐', '周末旅行'] as const;

export const countries = [
  { id: 'us', label: '美国', available: true },
  { id: 'uk', label: '英国', available: false },
  { id: 'ca', label: '加拿大', available: false },
  { id: 'au', label: '澳大利亚', available: false },
  { id: 'nz', label: '新西兰', available: false }
];
