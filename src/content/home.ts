// Homepage copy. Everything here is PLACEHOLDER text — edit freely.
// The success stories below are made up and must be replaced with real
// ones (with the student's/parent's permission) before going live.

export const HERO = {
  eyebrow: 'Thursdays · 10 weeks',
  title: 'Memorise the Qur’an, one Thursday at a time',
  subtitle:
    'A friendly, structured 10-week Hifz class for children and adults. Weekly one-to-one recitation, clear targets, and a progress record you and your family can follow online.',
}

export const HIGHLIGHTS = [
  { icon: '📖', title: 'Weekly recitation', text: 'Recite your new and old Hifz to a teacher every Thursday.' },
  { icon: '🎯', title: 'Clear targets', text: 'Set a personal page target and see your progress ring fill up.' },
  { icon: '🏅', title: 'Badges & certificate', text: 'Earn badges along the way and a certificate at the end.' },
  { icon: '👪', title: 'Family can follow', text: 'Parents can check the weekly record with the student code.' },
]

export interface WeekPlan {
  weeks: string
  title: string
  text: string
}

export const STRUCTURE: WeekPlan[] = [
  {
    weeks: 'Week 1',
    title: 'Welcome & assessment',
    text: 'Meet your teacher, a short recitation assessment, and agree a personal target for the 10 weeks.',
  },
  {
    weeks: 'Weeks 2–3',
    title: 'Building the habit',
    text: 'Short daily portions, the three-part routine (new, old, revision) and core memorisation techniques.',
  },
  {
    weeks: 'Weeks 4–5',
    title: 'Tajweed in practice',
    text: 'Focus on correct makharij and common tajweed rules as they appear in your own portion.',
  },
  {
    weeks: 'Week 6',
    title: 'Mid-point review',
    text: 'Recite everything memorised so far, review progress against your target and adjust the plan.',
  },
  {
    weeks: 'Weeks 7–9',
    title: 'Momentum & consolidation',
    text: 'Increase new Hifz where possible while keeping revision strong so nothing is forgotten.',
  },
  {
    weeks: 'Week 10',
    title: 'Final recitation & celebration',
    text: 'Recite your full portion, receive your certificate, and plan how to keep going after the class.',
  },
]

export interface Story {
  name: string
  role: string
  quote: string
  stat: string
}

export const STORIES: Story[] = [
  {
    name: 'Aisha, age 11',
    role: 'Student',
    quote:
      'I used to forget what I learned by the next week. Doing a little bit every day and seeing my badges made me want to keep going.',
    stat: 'Memorised Juz ʿAmma',
  },
  {
    name: 'Yusuf’s mum',
    role: 'Parent',
    quote:
      'Being able to see his weekly notes online meant we knew exactly what to practise at home. He has never been this consistent.',
    stat: '10/10 weeks attended',
  },
  {
    name: 'Ibrahim, adult learner',
    role: 'Student',
    quote:
      'I always wanted to start Hifz but didn’t know how. The structure and the weekly check-in gave me the accountability I needed.',
    stat: '12 pages of new Hifz',
  },
]

export interface GalleryItem {
  caption: string
  /** Optional image URL. Leave undefined to show a placeholder tile. */
  src?: string
}

export const GALLERY: GalleryItem[] = [
  { caption: 'Thursday class in session' },
  { caption: 'One-to-one recitation' },
  { caption: 'Certificate day' },
  { caption: 'Tajweed workshop' },
  { caption: 'Our classroom' },
  { caption: 'End-of-term celebration' },
]
