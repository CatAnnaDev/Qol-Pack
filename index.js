const SettingsUI = require('tera-mod-ui').Settings;
const config = require('./loot.js');

module.exports = function QolPack(mod) {
  const CATEGORY_GLOBAL = 9999
	const SKILL_FLYING_DISMOUNT = 65000001
	var currZone;
  
  let interval = null;
      lastTimeMoved = Date.now();
      interval = config.interval,
      throttleMax = config.throttleMax,
      scanInterval = config.scanInterval,
      radius = config.radius;

      let npcs = new Set();

      let characters = []
      let position = -1

  let location = null,
      items = new Map(),
      lootTimeout = null;
 
      let w,
          loc,
          dest,
          job,
          templateId;

      let gameId = -0n,
          outOfEnergy = false,
          dismountByUser = false,
          mountDisabled = false,
          inCombat = false,
          mountSkill = -1,
          serverMounted = false,
          remountTimer = null,
          unlock = false

  const command = mod.command

  mod.game.on('enter_game', () => {
		iCount = mod.setInterval(removeBodyBlock, 3000)
	})
//removeBodyBlock
const partyMembers = new Set()
const cache = Object.create(null)
const partyObj = Object.create(null)
let iCount = null

function removeBodyBlock() {
  if (!mod.settings.bodyblock) return
  for (let i = partyMembers.values(), step; !(step = i.next()).done;) {
    partyObj.leader = step.value
    partyObj.unk1   = cache.unk1
    partyObj.unk2   = cache.unk2
    partyObj.unk3   = cache.unk3
    partyObj.unk4   = 1
    mod.send('S_PARTY_INFO', 1, partyObj)
  }
}

mod.hook('S_PARTY_INFO', 1, (event) => {
  Object.assign(cache, event)
})

mod.hook('S_PARTY_MEMBER_LIST', 7, (event) => {
  partyMembers.clear()
  for (let i = 0, arr = event.members, len = arr.length; i < len; ++i) {
    const member = arr[i]
    if (!member.online) continue
    partyMembers.add(member.gameId)
  }
})

//ADBLOCK 
mod.hook("C_REQUEST_SERVER_ADMINTOOL_AWESOMIUM_URL", 1, () => {
    if (mod.settings.Blocker) return false;
}) 

//AFK
mod.hook('C_PLAYER_LOCATION', 5, (event) => {
    if([0,1,5,6].indexOf(event.type) > -1) { // running / walking / jumping / jumping
      lastTimeMoved = Date.now();
    }
  })

  mod.hook('C_RETURN_TO_LOBBY', 1, () => {
    if (mod.settings.afk && Date.now() - lastTimeMoved >= 3600000) return false; // Prevents you from being automatically logged out while AFK
  })

  //AutoLOOT
  mod.game.me.on('change_zone', () => { items.clear(); });
	
  mod.hook('S_RETURN_TO_LOBBY', 1, () => { items.clear(); });
  mod.hook('C_PLAYER_LOCATION', 5, (e) => { location = e.loc; });
  mod.hook('S_SYSTEM_MESSAGE', 1, (e) => { if (e.message === '@41') return false });
  mod.hook('C_TRY_LOOT_DROPITEM', 4, () => { if(mod.settings.loot && !lootTimeout) lootTimeout = setTimeout(tryLoot, interval); });
  mod.hook('S_DESPAWN_DROPITEM', 4, (e) => { items.delete(e.gameId); });

  mod.hook('S_SPAWN_DROPITEM', 8, (e) => {
        if(!(config.blacklist.includes(e.item)) && (e.item < 8000 || e.item > 8025) && e.owners.some(owner => owner === mod.game.me.playerId)){
			items.set(e.gameId, Object.assign(e, {priority: 0}));
			if(mod.settings.lootauto && !lootTimeout) tryLoot();
        }
    });

    function tryLoot() {
		clearTimeout(lootTimeout);
		lootTimeout = null;
		if(!items.size || mod.game.me.mounted) return;
		for(let item of [...items.values()].sort((a, b) => a.priority - b.priority)){
			if(location.dist3D(item.loc) <= radius){
				mod.send('C_TRY_LOOT_DROPITEM', 4, { gameId: item.gameId });
				lootTimeout = setTimeout(tryLoot, Math.min(interval * ++item.priority, throttleMax));
				return;
			}
    }
    if(mod.settings.lootauto) setTimeout(tryLoot, scanInterval);
    }

//Retaliate
let RETALIATE = {
  reserved: 0,
  npc: false,
  type: 1,
  huntingZoneId: 0,
  id: 0
},

RETALIATE_IDs = [
  131000, // Warrior
  111000, // Lancer
  101000, // Slayer
  103000, // Berserker
  141000, // Sorcerer
  141000, // Archer
  251000, // Priest
  211000, // Mystic
  140300, // Reaper
  201000, // Gunner
  121000, // Brawler
  101000, // Ninja
  181099, // Valkyrie
];

mod.hook('S_LOGIN', 14, (event) => {
      job = (event.templateId - 10101) % 100;
      RETALIATE.id = RETALIATE_IDs[job];
      templateId = event.templateId;
  });

  mod.hook('C_PLAYER_LOCATION', 5, (event) => {
      w = event.w;
      loc = event.loc;
      dest = event.dest;
  });

  mod.hook('S_EACH_SKILL_RESULT', 14, (event) => {
      if (mod.settings.retaliate || event.reaction.skill.id !== (templateId * 100) + 2)
          return;

      mod.send('C_START_SKILL', 7, {
              skill: RETALIATE,
              w: w,
              loc: loc,
              dest: dest,
              unk: true,
              moving: false,
              cont: false,
              target: 0,
              unk2: false
          }
      );
  });

//BAMHPBAR
function update_hp(){
  mod.toClient('S_BOSS_GAGE_INFO', 3, gage_info);
}
// 0: 0% <= hp < 20%, 1: 20% <= hp < 40%, 2: 40% <= hp < 60%, 3: 60% <= hp < 80%, 4: 80% <= hp < 100%, 5: 100% hp
function correct_hp(stage){
  let boss_hp_stage = BigInt(20*(1+stage));
  if(gage_info.curHp * 100n / gage_info.maxHp > boss_hp_stage) // we missed some part of the fight?
  {
    //command.message("correcting bam hp from " + String(gage_info.curHp) + " (" + String(gage_info.curHp * 100n / gage_info.maxHp) + "%) to " + String(gage_info.maxHp * boss_hp_stage / 100n) + " (" + String((gage_info.maxHp * boss_hp_stage / 100n) * 100n / gage_info.maxHp) + "%)");
    gage_info.curHp = gage_info.maxHp * boss_hp_stage / 100n;
    update_hp();
    command.message('Correcting boss hp down to <font color="#E69F00">' + String(boss_hp_stage) + '</font>%');
  }
}
mod.hook('S_SPAWN_NPC', 11, (event) => {
    if (!mod.settings.bamhp || event.walkSpeed != 240) return;
    
    switch (event.templateId)
    {
      case 5001: // Ortan
        event.shapeId = 303730;
        event.templateId = 7000;
        event.huntingZoneId = 434;
        load(event);
        return true;
      case 4001: // Cerrus
        event.shapeId = 303750;
        event.templateId = 1000;
        event.huntingZoneId = 994;
        load(event);
        return true;
      case 501:  // Hazard
        event.shapeId = 303740;
        event.templateId = 77730;
        event.huntingZoneId = 777;
        load(event);
        return true;
    }
  });
function load(e){
  //console.log("BAM " + event.templateId + " FOUND, and his name is: " + event.npcName + ", id: " + String(event.gameId));
  gage_info.id = e.gameId;
  gage_info.curHp = gage_info.maxHp;
  correct_hp(e.hpLevel);
  if(e.mode)
  {
    command.message('You missed ~ <font color="#E69F00">' + Math.round((99999999 - e.remainingEnrageTime)/1000) + '</font> sec. of the fight');
  }
  if(e.hpLevel == 5)
  {
    command.message("BAM is at full 100% hp, nobody touched it");
  }
  else if(e.hpLevel == 0)
  {
    command.message("BAM is likely far below 20% hp, it may die any moment now");
  }
  if(!hooks.length)
  {
    setTimeout(update_hp, 1000);
    mod.hook('S_NPC_STATUS', 2, (event) => {
      if (event.gameId === gage_info.id)
      {
        correct_hp(event.hpLevel);
      }
    });
    
    mod.hook('S_EACH_SKILL_RESULT', mod.majorPatchVersion >= 86 ? 14 : 13, (event) => {
      if (event.target === gage_info.id && event.type === 1)
      {
        gage_info.curHp -= event.value;
        update_hp();
      }
    });
    
    mod.hook('S_DESPAWN_NPC', 3, (event) => {
      if (event.gameId === gage_info.id)
      {
        //console.log("BAM " + gage_info.templateId + " Despawned " + event.type + ", ID: " + String(event.gameId));
        unload();
      }
    });
  }
  }
  //Broker
  command.add('broker', () => {
		mod.send('S_NPC_MENU_SELECT', 1 , {type:28})
		});
//Exit
mod.hook('S_PREPARE_EXIT', 1, event => {
  if (mod.settings.exit) return;
  mod.send('S_EXIT', 3, {
      category: 0,
      code: 0
  });
});
//Fly + unlock

mod.hook('C_PLAYER_FLYING_LOCATION', 4, (event) => {
  location = {
    flying: true,
    pos: event.loc,
    dir: event.w
  }
  
  if (outOfEnergy && event.type !== 7 && event.type !== 8) {
    event.type = 7
    return true
  }
})

mod.hook('S_LOAD_TOPO', 3, e=>{
  currZone = e.zone;
});

mod.hook('C_PLAYER_LOCATION', 5, e=>{
  return !([2, 10].includes(e.type) && (currZone < 10 || currZone > 200));       
});

mod.hook('C_PLAYER_LOCATION', 5, (event) => {
  location = {
    flying: false,
    pos: event.loc,
    dir: event.w
  }
})

mod.hook('C_START_SKILL', 7, (event) => {
  if (event.skill.id == mountSkill || event.skill.id == SKILL_FLYING_DISMOUNT) {
    dismountByUser = true
    mountSkill = -1
  }
})

mod.hook('S_CANT_FLY_ANYMORE', 1, (event) => {
  return false
})

mod.hook('S_MOUNT_VEHICLE', 2, {order: 10}, (event) => {
  if (event.gameId == mod.game.me.gameId) {
    const fakeMounted = mountSkill !== -1
    serverMounted = true
    mountSkill = event.skill
    if (fakeMounted) {
      return false
    }
  }
})

mod.hook('S_PLAYER_CHANGE_FLIGHT_ENERGY', 1, (event) => {
  outOfEnergy = (event.energy === 0)
})

mod.hook('S_SKILL_CATEGORY', 3, (event) => {
  if (event.category == CATEGORY_GLOBAL) {
    mountDisabled = !event.enabled
  }
})

mod.hook('S_UNMOUNT_VEHICLE', 2, {order: 10}, (event) => {
  if (event.gameId != mod.game.me.gameId) {
    return
  }
  serverMounted = false
  if (!location.flying || dismountByUser) {
    dismountByUser = false
    mountSkill = -1
  } else {
    clearTimeout(remountTimer)
    remountTimer = setTimeout(tryRemount, 50)
    return false
  }
})

mod.hook('S_USER_STATUS', 3, (event) => {
  if (event.gameId == mod.game.me.gameId) {
    inCombat = event.status == 1
  }
})

function tryRemount() {
  if (!mountDisabled && !inCombat) {
    mod.send('C_START_SKILL', 7, {
      skill: mountSkill,
      w: location.dir,
      loc: location.pos,
      unk: true
    })
    remountTimer = setTimeout(() => {
      if (!serverMounted) {
        mod.send('S_UNMOUNT_VEHICLE', 2, {
          gameId,
          skill: mountSkill
        })
        mountSkill = -1
      }
    }, 1000)
  } else {
    mod.send('S_UNMOUNT_VEHICLE', 2, {
      gameId,
      skill: mountSkill
    })
    mountSkill = -1
  }
}

mod.hook('S_ABNORMALITY_BEGIN', 4, event => {
  if (!mod.game.me.is(event.target)) return
  if (event.id === 30010000) unlock = true
})
  
mod.hook('S_ABNORMALITY_END', 1, event => {
  if (!mod.game.me.is(event.target)) return
  if (event.id === 30010000) unlock = false
})

mod.game.me.on('change_zone', (zone, quick) => {
  if (zone === 2000 && !unlock) {
    unlock = true
    mod.send('S_ABNORMALITY_BEGIN', 4, {
      target: mod.game.me.gameId,
      source: mod.game.me.gameId,
      id: 30010000,
      duration: 0x7FFFFFFF,
      stacks: 1
    })
  }
  
  if (zone !== 2000 && unlock) {
    unlock = false
    mod.send('S_ABNORMALITY_END', 1, {
      target: mod.game.me.gameId,
      id: 30010000
    })
  }
})
//Revive
mod.hook('S_CREATURE_LIFE', 3, {order: 9999}, ({gameId, alive, loc})=>{
  if(mod.settings.revive)
  {
    const member = mod.settings.party ? (partyMembers.find((memb) => memb.gameId === gameId)) : null;
    if (!member && gameId !== mod.game.me.gameId) return;
    
    if(!alive)
    {
      isDead[gameId] = true;
      if(gameId === mod.game.me.gameId) { setTimeout(clearMyBuffs, 280);} // fix for bugged CC skills?
      if(mod.settings.drama)
      {
        setTimeout(fakeDeath, 300, gameId, loc, 0);
        setTimeout(fakeDeath, 5000, gameId, loc, 1);
      }
      else
      {
        fakeDeath(gameId, loc, 1);
        setTimeout(fakeDeath, 300, gameId, loc, 1); // in case player was moving\using skills during death
        setTimeout(fakeDeath, 2000, gameId, loc, 1);
        setTimeout(fakeDeath, 4000, gameId, loc, 1);
      }
      return false; // we wont't have to waste time reviving if we don't die
    }
    else
    {
      fakeDeathEnd(gameId, loc);
      isDead[gameId] = false;
    }
  }
});

mod.hook('S_PARTY_MEMBER_LIST', 7, ({members}) => {
  partyMembers = members;
});

mod.hook('S_LEAVE_PARTY_MEMBER', 2, ({playerId}) => {
  const mpos = partyMembers.findIndex((memb) => memb.playerId === playerId);
  if (mpos === -1) return;
  
  delete isDead[partyMembers[mpos].gameId];
  partyMembers.splice(mpos, 1);
});

mod.hook('S_LEAVE_PARTY', 1, () => {
  partyMembers.length = 0;
})

function fakeDeath(Id, Loc, Stage)
{
  if(isDead[Id])
  {
    mod.send('S_ACTION_STAGE', 9, {	
      gameId: Id,
      templateId: 11006,
      speed: 1,
      projectileSpeed: 1,
      stage: Stage,
      id: 9999999,
      effectScale: 1,
      dest: Loc,
      loc: Loc,
      skill: {
        reserved: 0,
        npc: false,
        type: 1,
        huntingZoneId: 0,
        id: 70300
      }});
    if(Stage === 1)
    {
      mod.toClient('S_INSTANT_MOVE', 3, {
        gameId: Id,
        loc: Loc
      });
    }
  }
}

function fakeDeathEnd(Id, Loc)
{
  mod.send('S_ACTION_END', 5, {	
    gameId: Id,
    templateId: 11006,
    type: 25,
    id: 9999999,
    loc: Loc,
    skill: {
      reserved: 0,
      npc: false,
      type: 1,
      huntingZoneId: 0,
      id: 70300
    }});
}

function clearMyBuffs()
{
  if(mod.game.me.abnormalities && isDead[mod.game.me.gameId])
  {
    Object.values(mod.game.me.abnormalities).forEach(abnormality => {
      mod.toClient('S_ABNORMALITY_END', 1, {
        target: mod.game.me.gameId,
        id: abnormality.id
      });
      command.message("Cleared abnormality " + abnormality.id)
    });
  }
}
//noMoreBubble
mod.hook("S_SPAWN_NPC", 11, (event)=> { 
  npcs.add(event.gameId); 
  if(event.replaceId !== 0n) npcs.delete(event.replaceId);
});
mod.hook("S_DESPAWN_NPC", 3, (event)=> { npcs.delete(event.gameId); });

mod.hook("S_QUEST_BALLOON", 1, (event) => {
  if(!mod.settings.Bubble) return;
  if(mod.settings.onlyPets && !npcs.has(event.source)) return false;
  else if(!mod.settings.onlyPets) return false;
});
//Relog
command.add('relog', arg => {
  if (!mod.game.me.alive) {
    sendMessage(`isn't state you can relog`)
    return
  }

  if (arg === 'nx') {
    if (++position > characters.length)
      position = 1
  } else if (/^\d+$/.test(arg)) {
    const nextPosition = Number(arg)
    if (nextPosition > characters.length)
      return sendMessage(`Not found ${nextPosition}th character`)
    else
      position = nextPosition
  } else {
    const found = characters.find(char => char.name.toLowerCase() === arg.toLowerCase())
    if (found)
      position = found.position
    else
      return sendMessage(`Not found '${arg}'`)
  }

  relog()
})
mod.hook('S_GET_USER_LIST', 17, event => {
  characters = event.characters
})
mod.hook('C_SELECT_USER', 1, event => {
  position = characters.find(char => char.id === event.id).position
})
function relog() {
  mod.send('C_RETURN_TO_LOBBY', 1, {})
  let prepareLobbyHook, lobbyHook
  prepareLobbyHook = mod.hookOnce('S_PREPARE_RETURN_TO_LOBBY', 1, () => {
    mod.send('S_RETURN_TO_LOBBY', 1, {})
    lobbyHook = mod.hookOnce('S_RETURN_TO_LOBBY', 1, () => {
      setImmediate(() => {
        mod.send('C_SELECT_USER', 1, { id: characters.find(char => char.position === position).id })
      })
    })
  })
  setTimeout(() => {
    for (const hook of [prepareLobbyHook, lobbyHook])
      if (hook)
        mod.unhook(hook)
  }, 16000)
}
	// Inspect
	mod.hook('S_ANSWER_INTERACTIVE', 2, event => {
		if (mod.settings.inspect) {
			mod.send('C_REQUEST_USER_PAPERDOLL_INFO', 3, {
				zoom: false,
				name: event.name
			})
		}
	})
	
// Cutscene-Skip
mod.hook('S_PLAY_MOVIE', 1, event => {
		if (mod.settings.cutsceneSkip) {
			mod.send('C_END_MOVIE', 1, {
				movie: event.movie,
				unk: true
			})
			return false
		}
  })
// Success-Chance
mod.hook('S_REGISTER_EVOLUTION_ITEM', 3, event => {
		if (mod.settings.successChance) {
			event.hideSuccessChance = false
			return true
		}
	})
	
	mod.hook('S_REGISTER_ENCHANT_ITEM', 3, event => {
		if (mod.settings.successChance) {
			event.hideSuccessChance = false
			return true
		}
	})
// Hide-Number
mod.hook('S_EACH_SKILL_RESULT', 14, event => {
      switch (event.type) {
        case 1:
          if (!mod.settings.damageNumber && event.target != mod.game.me.gameId) {
            event.type = 0
            return true
          }
          if (!mod.settings.damageNumberMe && event.target == mod.game.me.gameId) {
            event.type = 0
            return true
          }
          break
        case 2:
          if (!mod.settings.healNumber && event.target != mod.game.me.gameId) {
            event.type = 0
            return true
          }
          if (!mod.settings.healNumberMe && event.target == mod.game.me.gameId) {
            event.type = 0
            return true
          }
          break
        case 3:
          if (!mod.settings.mpNumber && event.target != mod.game.me.gameId) {
            event.type = 0
            return true
          }
          if (!mod.settings.mpNumberMe && event.target == mod.game.me.gameId) {
            event.type = 0
            return true
          }
          break
        default:
          break
      }
    })
    
// Lockon-You-Msg
mod.hook('S_LOCKON_YOU', 1, event => {
        if (!mod.settings.lockonYouMsg) {
          return false
        }
      })
// Find-ItemID
mod.hook('S_SHOW_ITEM_TOOLTIP', 14, event => {
      if (mod.settings.findItemID) {
        sendMessage("itemID: " + event.id)
        mod.log("[S_SHOW_ITEM_TOOLTIP] itemID: " + event.id)
      }
    })
	
    mod.hook('C_REQUEST_NONDB_ITEM_INFO', 2, event => {
      if (mod.settings.findItemID) {
        sendMessage("itemID: " + event.item)
        mod.log("[C_REQUEST_NONDB_ITEM_INFO] itemID: " + event.item)
      }
    })
    
//Ui
let ui = null;
if (global.TeraProxy.GUIMode) {
  ui = new SettingsUI(mod, require('./settings_structure'), mod.settings, { alwaysOnTop: true, width: 550, height: 600 });
  ui.on('update', settings => { mod.settings = settings; });

  this.destructor = () => {
    if (ui) {
      ui.close();
      ui = null;
    }
  };
}
//Command
  command.add('qp', {
    'abb': () => {
      mod.settings.bodyblock = !mod.settings.bodyblock
      if (mod.settings.bodyblock) {
        interval = mod.setInterval(removeBodyBlock, 5000);
      }
      else {
        mod.clearInterval(interval);
      }
      sendMessage("Anti-BodyBlock: " + (mod.settings.bodyblock ? "On" : "Off"));
    },
    'adb': () => {
      mod.settings.Blocker = !mod.settings.Blocker
      sendMessage("AD-Blocker: " + (mod.settings.Blocker ? "On" : "Off"));
    },
    'afk': () => {
      mod.settings.afk = !mod.settings.afk
      sendMessage("Anti-AFK: " + (mod.settings.afk ? "On" : "Off"));
    },
    'loot': {
      $default() {
        mod.settings.loot = !mod.settings.loot
        sendMessage("Loot: " + (mod.settings.loot ? "On" : "Off")); 
      },    
        auto() {
          mod.settings.lootauto = !mod.settings.lootauto
          sendMessage("Auto-Loot-Retry: " + (mod.settings.lootauto ? "On" : "Off")); 
        }
    },
    'retaliate': () => {
      mod.settings.retaliate = !mod.settings.retaliate
      sendMessage("Auto-Retaliate: " + (mod.settings.retaliate ? "On" : "Off"));
    },
    'bamhp': () => {
      mod.settings.bamhp = !mod.settings.bamhp
      sendMessage("BamhpBar: " + (mod.settings.bamhp ? "On" : "Off"));
    },
    'exit': () => {
      mod.settings.exit = !mod.settings.exit
      sendMessage("Exit: " + (mod.settings.exit ? "On" : "Off"));
    },
    'revive': {
      $none() {
        mod.settings.revive = !mod.settings.revive
        sendMessage(`for Self: ${mod.settings.revive ? 'En' : 'Dis'}abled`);
      },
      party() {
        mod.settings.party = !mod.settings.party
        sendMessage(`for Party: ${mod.settings.party ? 'En' : 'Dis'}abled`);
      },
      drama() {
        mod.settings.drama = !mod.settings.drama
        sendMessage(`Drama: ${mod.settings.drama ? 'En' : 'Dis'}abled`);
      }
    },
    'Bubble': {
      $default() { 
        mod.settings.Bubble = !mod.settings.Bubble
      sendMessage(`Bubble: ${mod.settings.drama ? 'En' : 'Dis'}abled`);
    },
      pets() { 
        mod.settings.onlyPets = !mod.settings.onlyPets
      sendMessage("onlyPets: " + (mod.settings.exit ? "On" : "Off"));
    }
    },
    'UI': () => {
      ui.show();
    },
    '$default': () => {
      sendMessage(`Invalid argument. Read the Readme in the mod folder`);
    }
  });
  //Msg
  function sendMessage(msg) { mod.command.message(msg) }
  
  function unload()
	{
		if(hooks.length)
		{
			for(let h of hooks) mod.unhook(h);

			hooks = []
		}
  }
//destructor
  this.destructor = () => {
		lastTimeMoved = null;
		command.remove('qol', 'q');
	}

};
