"use client";

import { AVATARS } from "@amonglies/shared";

interface AvatarProps {
  avatarId: string;
  size?: "sm" | "md" | "lg" | "xl";
  selected?: boolean;
  onClick?: () => void;
}

const sizeMap = {
  sm: "w-8 h-8 text-lg",
  md: "w-12 h-12 text-2xl",
  lg: "w-16 h-16 text-3xl",
  xl: "w-24 h-24 text-5xl",
};

const AVATAR_EMOJIS: Record<string, string> = {
  fox: "\u{1F98A}",
  wolf: "\u{1F43A}",
  cat: "\u{1F431}",
  owl: "\u{1F989}",
  bear: "\u{1F43B}",
  rabbit: "\u{1F430}",
  panda: "\u{1F43C}",
  lion: "\u{1F981}",
  penguin: "\u{1F427}",
  frog: "\u{1F438}",
  octopus: "\u{1F419}",
  dragon: "\u{1F432}",
  ghost: "\u{1F47B}",
  alien: "\u{1F47D}",
  robot: "\u{1F916}",
  ninja: "\u{1F977}",
  pirate: "\u{1F3F4}\u{200D}\u{2620}\u{FE0F}",
  wizard: "\u{1F9D9}",
  astronaut: "\u{1F468}\u{200D}\u{1F680}",
  viking: "\u{1F9D4}",
  mushroom: "\u{1F344}",
  cactus: "\u{1F335}",
  flame: "\u{1F525}",
  diamond: "\u{1F48E}",
};

export function Avatar({ avatarId, size = "md", selected = false, onClick }: AvatarProps) {
  const avatar = AVATARS.find((a) => a.id === avatarId);
  const emoji = AVATAR_EMOJIS[avatarId] || "\u{2753}";
  const color = avatar?.color || "#8B5CF6";

  const className = `
    ${sizeMap[size]}
    rounded-full flex items-center justify-center
    transition-all duration-200
    ${selected ? "ring-3 ring-primary ring-offset-2 ring-offset-bg-primary scale-110" : ""}
    ${onClick ? "cursor-pointer hover:scale-105" : "cursor-default"}
  `;
  const style = { backgroundColor: `${color}22`, borderColor: color, borderWidth: 2, borderStyle: "solid" };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={style}>
        <span className="leading-none">{emoji}</span>
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      <span className="leading-none">{emoji}</span>
    </div>
  );
}
