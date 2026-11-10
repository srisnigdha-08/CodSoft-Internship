import type { PipelineStage } from "mongoose";
import { SchoolClass, Student, User } from "./models/index.js";

type JoinStages = PipelineStage.FacetPipelineStage[];

/** Joins one referenced document onto `as`, projecting only the listed fields so hashes can never be pulled in. */
function joinOne(from: string, localField: string, as: string, fields: string[], optional = false): JoinStages {
  return [
    { $lookup: { from, localField, foreignField: "_id", as, pipeline: [{ $project: Object.fromEntries(fields.map((field) => [field, 1])) }] } },
    { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: optional } },
  ];
}

export const joinUserEmail = joinOne(User.collection.name, "userId", "user", ["email"]);
export const joinOptionalClass = joinOne(SchoolClass.collection.name, "classId", "schoolClass", ["name", "section"], true);
export const joinClass = joinOne(SchoolClass.collection.name, "classId", "schoolClass", ["name", "section"]);
export const joinStudent = joinOne(Student.collection.name, "studentId", "student", ["firstName", "lastName", "studentNumber"]);

export function allOf(conditions: Array<Record<string, unknown>>): Record<string, unknown> {
  return conditions.length ? { $and: conditions } : {};
}

/** A filter that can match nothing, for a scope whose ID list is empty. */
export const NO_MATCH = { _id: { $in: [] } };
