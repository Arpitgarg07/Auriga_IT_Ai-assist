import { Apple, BookOpen, Brain, Droplets, Dumbbell, Footprints, Heart, Moon, Sun, Target } from 'lucide-react'

const ICONS = { Target, Droplets, BookOpen, Dumbbell, Apple, Moon, Sun, Heart, Brain, Footprints }

// `HABIT_ICONS` in constants.js is the canonical name list used by the picker;
// the map below must stay in sync. Unknown names fall back to Target so records
// written by an older build keep rendering after the icon list changes.
export default function HabitIcon({ name, size = 20 }) {
  const Icon = ICONS[name] || Target
  return <Icon size={size} />
}
