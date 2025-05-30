// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  DbContext,
  ErrorContextInterface,
  Event,
  EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";
import { EquipmentSlotType as __EquipmentSlotType } from "./equipment_slot_type_type";
import { ItemCategory as __ItemCategory } from "./item_category_type";
import { TargetType as __TargetType } from "./target_type_type";
import { CostIngredient as __CostIngredient } from "./cost_ingredient_type";

export type ItemDefinition = {
  id: bigint,
  name: string,
  description: string,
  category: __ItemCategory,
  iconAssetName: string,
  isStackable: boolean,
  stackSize: number,
  isEquippable: boolean,
  equipmentSlotType: __EquipmentSlotType | undefined,
  fuelBurnDurationSecs: number | undefined,
  primaryTargetDamageMin: number | undefined,
  primaryTargetDamageMax: number | undefined,
  primaryTargetYieldMin: number | undefined,
  primaryTargetYieldMax: number | undefined,
  primaryTargetType: __TargetType | undefined,
  primaryYieldResourceName: string | undefined,
  secondaryTargetDamageMin: number | undefined,
  secondaryTargetDamageMax: number | undefined,
  secondaryTargetYieldMin: number | undefined,
  secondaryTargetYieldMax: number | undefined,
  secondaryTargetType: __TargetType | undefined,
  secondaryYieldResourceName: string | undefined,
  pvpDamageMin: number | undefined,
  pvpDamageMax: number | undefined,
  bleedDamagePerTick: number | undefined,
  bleedDurationSeconds: number | undefined,
  bleedTickIntervalSeconds: number | undefined,
  craftingCost: __CostIngredient[] | undefined,
  craftingOutputQuantity: number | undefined,
  craftingTimeSecs: number | undefined,
  consumableHealthGain: number | undefined,
  consumableHungerSatiated: number | undefined,
  consumableThirstQuenched: number | undefined,
  consumableStaminaGain: number | undefined,
  consumableDurationSecs: number | undefined,
  cookTimeSecs: number | undefined,
  cookedItemDefName: string | undefined,
  damageResistance: number | undefined,
  warmthBonus: number | undefined,
  respawnTimeSeconds: number | undefined,
  attackIntervalSecs: number | undefined,
};

/**
 * A namespace for generated helper functions.
 */
export namespace ItemDefinition {
  /**
  * A function which returns this type represented as an AlgebraicType.
  * This function is derived from the AlgebraicType used to generate this type.
  */
  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createProductType([
      new ProductTypeElement("id", AlgebraicType.createU64Type()),
      new ProductTypeElement("name", AlgebraicType.createStringType()),
      new ProductTypeElement("description", AlgebraicType.createStringType()),
      new ProductTypeElement("category", __ItemCategory.getTypeScriptAlgebraicType()),
      new ProductTypeElement("iconAssetName", AlgebraicType.createStringType()),
      new ProductTypeElement("isStackable", AlgebraicType.createBoolType()),
      new ProductTypeElement("stackSize", AlgebraicType.createU32Type()),
      new ProductTypeElement("isEquippable", AlgebraicType.createBoolType()),
      new ProductTypeElement("equipmentSlotType", AlgebraicType.createOptionType(__EquipmentSlotType.getTypeScriptAlgebraicType())),
      new ProductTypeElement("fuelBurnDurationSecs", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("primaryTargetDamageMin", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("primaryTargetDamageMax", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("primaryTargetYieldMin", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("primaryTargetYieldMax", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("primaryTargetType", AlgebraicType.createOptionType(__TargetType.getTypeScriptAlgebraicType())),
      new ProductTypeElement("primaryYieldResourceName", AlgebraicType.createOptionType(AlgebraicType.createStringType())),
      new ProductTypeElement("secondaryTargetDamageMin", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("secondaryTargetDamageMax", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("secondaryTargetYieldMin", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("secondaryTargetYieldMax", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("secondaryTargetType", AlgebraicType.createOptionType(__TargetType.getTypeScriptAlgebraicType())),
      new ProductTypeElement("secondaryYieldResourceName", AlgebraicType.createOptionType(AlgebraicType.createStringType())),
      new ProductTypeElement("pvpDamageMin", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("pvpDamageMax", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("bleedDamagePerTick", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("bleedDurationSeconds", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("bleedTickIntervalSeconds", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("craftingCost", AlgebraicType.createOptionType(AlgebraicType.createArrayType(__CostIngredient.getTypeScriptAlgebraicType()))),
      new ProductTypeElement("craftingOutputQuantity", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("craftingTimeSecs", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("consumableHealthGain", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("consumableHungerSatiated", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("consumableThirstQuenched", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("consumableStaminaGain", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("consumableDurationSecs", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("cookTimeSecs", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("cookedItemDefName", AlgebraicType.createOptionType(AlgebraicType.createStringType())),
      new ProductTypeElement("damageResistance", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("warmthBonus", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
      new ProductTypeElement("respawnTimeSeconds", AlgebraicType.createOptionType(AlgebraicType.createU32Type())),
      new ProductTypeElement("attackIntervalSecs", AlgebraicType.createOptionType(AlgebraicType.createF32Type())),
    ]);
  }

  export function serialize(writer: BinaryWriter, value: ItemDefinition): void {
    ItemDefinition.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): ItemDefinition {
    return ItemDefinition.getTypeScriptAlgebraicType().deserialize(reader);
  }

}


