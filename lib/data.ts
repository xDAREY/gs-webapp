export const CARE_TAGS = [
  'Medication',
  'Meal & Fluids',
  'Activity',
  'Rest & Sleep',
  'Behavior & Mood',
  'Other',
]

export const SEIZURE_OBSERVATIONS = [
  'Sudden stare',
  'Unresponsive to name',
  'Prompt recovery',
  'Sudden onset nausea',
  'Vision problems',
  'Jerking of a limb',
  'Gradual recovery',
  'Stiffening / convulsive activity',
  'Laboured breathing',
  'Unconsciousness',
  'Slow recovery',
]

export const ROUTES_OF_ADMINISTRATION = [
  'Oral',
  'Topical',
  'Subcutaneous',
  'Intramuscular',
  'Intravenous',
  'Inhalation',
  'Sublingual',
  'Rectal',
  'Ophthalmic',
  'Otic',
  'Nasal',
  'Enteral (G-tube/feeding tube)',
  'Other',
]

// Grouped household + nursing care task checklist, matching the agency's
// paper task sheet. TaskModal renders one section per group, each task as
// a checkbox row.
export const TASK_GROUPS: { label: string; tasks: string[] }[] = [
  {
    label: 'Household tasks',
    tasks: [
      'Pick up prescriptions',
      'Accompany client to medical appointment',
      'Provide / arrange oversight',
      'Light housekeeping',
    ],
  },
  {
    label: 'Nursing care tasks',
    tasks: [
      'Catheter care',
      'Ventilator care',
      'Tracheostomy care',
      'Medication administration',
      'G-tube feeding / care',
      'Wound care',
      'Diabetic care',
      'Injections',
      'Colostomy care / teaching',
      'Enteral / parenteral feedings',
      'IV therapy',
      'Post-op / recovery care',
    ],
  },
]

export const TEMPERATURE_METHODS = ['Oral', 'Tympanic', 'Axillary', 'Temporal', 'Rectal']

export const CRITICAL_OBSERVATIONS = ['SEIZURE'] // used for highlight logic