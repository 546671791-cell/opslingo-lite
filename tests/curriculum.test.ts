import { describe, expect, it } from 'vitest';
import { cefrLevels, courseGroups, lifeCourses, studyMethods } from '../src/curriculum';

describe('US life curriculum', () => {
  it('provides every CEFR level and study method', () => {
    expect(cefrLevels.map((item) => item.id)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    expect(studyMethods).toHaveLength(4);
  });

  it('has complete level ladders and playable learning content', () => {
    expect(lifeCourses).toHaveLength(6);
    for (const course of lifeCourses) {
      expect(course.steps.map((step) => step.level)).toEqual(cefrLevels.map((level) => level.id));
      expect(course.keywords.length).toBeGreaterThanOrEqual(6);
      expect(course.steps.every((step) => step.phrase && step.meaning && step.challenge)).toBe(
        true
      );
      expect(course.image).toMatch(/^images\/courses\/.+\.jpg$/);
    }
    expect(new Set(lifeCourses.map((course) => course.group))).toEqual(new Set(courseGroups));
  });
});
