import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

const gameMatchSchema = new Schema(
  {
    inviteId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 80,
    },
    whitePlayerId: { type: String, required: true, maxlength: 64 },
    blackPlayerId: { type: String, default: null, maxlength: 64 },
    // State includes the hidden RPG fields. API code deliberately projects them
    // out before serializing a match to either player's browser.
    state: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, required: true, default: 1, min: 1 },
    schemaVersion: { type: Number },
    rulesetVersion: { type: String },
    configVersion: { type: String },
    receipts: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, minimize: false },
);

gameMatchSchema.index({ updatedAt: -1 });

export const GameMatch =
  (models.GameMatch as
    Model<InferSchemaType<typeof gameMatchSchema>> | undefined) ||
  model("GameMatch", gameMatchSchema);
