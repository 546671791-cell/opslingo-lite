export interface LessonPhrase {
  id: string;
  text: string;
  meaning: string;
}

export interface CommunicationLesson {
  id: string;
  title: string;
  titleEn: string;
  icon: string;
  accent: string;
  categories: string[];
  phrases: LessonPhrase[];
  cultureTips: string[];
}

export const communicationLessons: CommunicationLesson[] = [
  {
    id: 'daily-communication',
    title: '日常交流',
    titleEn: 'Everyday Communication',
    icon: '💬',
    accent: 'coral',
    categories: ['日常生活', '购物与服务', '餐饮'],
    phrases: [
      { id: 'daily-1', text: 'Could you help me, please?', meaning: '你可以帮我一下吗？' },
      { id: 'daily-2', text: 'I do not quite understand.', meaning: '我不太明白。' },
      {
        id: 'daily-3',
        text: 'Could you say that again slowly?',
        meaning: '你可以慢一点再说一遍吗？'
      },
      { id: 'daily-4', text: 'That sounds good to me.', meaning: '听起来不错。' }
    ],
    cultureTips: [
      '提出请求时，在句尾加 please 会更自然、友好。',
      '听不清时优先说 Could you say that again?，比 What? 更礼貌。',
      '英语对话中简短回应也很重要，例如 I see、Sounds good。'
    ]
  },
  {
    id: 'work-collaboration',
    title: '工作协作',
    titleEn: 'Work Collaboration',
    icon: '🤝',
    accent: 'blue',
    categories: ['职场沟通', '科技'],
    phrases: [
      { id: 'work-1', text: 'Could you confirm the details?', meaning: '请确认一下细节好吗？' },
      { id: 'work-2', text: 'I will follow up by tomorrow.', meaning: '我会在明天前跟进。' },
      {
        id: 'work-3',
        text: 'Please let me know if anything changes.',
        meaning: '如有变化，请告诉我。'
      },
      { id: 'work-4', text: 'Thank you for the quick update.', meaning: '感谢你的快速更新。' }
    ],
    cultureTips: [
      '商务沟通中，把命令句改成 Could you… 或 Please… 会更得体。',
      'follow up 表示跟进；作为名词时通常写作 follow-up。',
      '说明截止时间时，用 by Friday 表示“在周五前完成”。'
    ]
  },
  {
    id: 'social-connection',
    title: '社交互动',
    titleEn: 'Social Connection',
    icon: '🌟',
    accent: 'purple',
    categories: ['社交'],
    phrases: [
      { id: 'social-1', text: 'It is a pleasure to meet you.', meaning: '很高兴认识你。' },
      { id: 'social-2', text: 'What do you recommend?', meaning: '你有什么推荐吗？' },
      { id: 'social-3', text: 'That is very thoughtful of you.', meaning: '你真周到。' },
      { id: 'social-4', text: 'Let us keep in touch.', meaning: '我们保持联系吧。' }
    ],
    cultureTips: [
      '初次见面时，It is a pleasure to meet you 比 Nice to meet you 更正式。',
      '谈话中适度追问或回应，能让交流显得自然而不是单向提问。',
      '对方提供帮助后，具体说出感谢的原因会更真诚。'
    ]
  },
  {
    id: 'time-planning',
    title: '数字与时间',
    titleEn: 'Numbers & Time',
    icon: '⏰',
    accent: 'gold',
    categories: ['数字与时间'],
    phrases: [
      { id: 'time-1', text: 'What time works best for you?', meaning: '什么时间对你最合适？' },
      { id: 'time-2', text: 'My schedule is full today.', meaning: '我今天的日程排满了。' },
      {
        id: 'time-3',
        text: 'Could we reschedule the meeting?',
        meaning: '我们可以重新安排会议吗？'
      },
      { id: 'time-4', text: 'I will be there at three o’clock.', meaning: '我会在三点到。' }
    ],
    cultureTips: [
      'o’clock 用于整点时间，不用于分钟。',
      'schedule 是日程安排；calendar 更偏向日历或个人日程。',
      '确认时间时重复日期、时区或上午下午，可避免误会。'
    ]
  },
  {
    id: 'getting-help',
    title: '求助与应急',
    titleEn: 'Getting Help',
    icon: '🆘',
    accent: 'green',
    categories: ['健康', '应急', '出行'],
    phrases: [
      { id: 'help-1', text: 'I need some assistance, please.', meaning: '我需要一些帮助。' },
      { id: 'help-2', text: 'Could you show me the way?', meaning: '你可以给我指一下路吗？' },
      { id: 'help-3', text: 'Is there a pharmacy nearby?', meaning: '附近有药店吗？' },
      { id: 'help-4', text: 'I think I am lost.', meaning: '我想我迷路了。' }
    ],
    cultureTips: [
      '需要帮助时先说明问题，再提出具体请求，沟通效率更高。',
      'health 和 emergency 场景需要专业协助时，应联系当地的紧急服务。',
      '在陌生地点问路时，Could you show me the way? 很自然。'
    ]
  }
];
