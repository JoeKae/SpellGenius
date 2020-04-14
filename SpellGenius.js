//todo
/**
 * make 100% oop
 * order functions
 * help text
 * add doc to each function
 * html outputs (/direct)
 * config using state
 * add heighten feat
 * find and fix bugs
 */

const disable_sudden_check = true;
const version = 'v0.8.1.pre-release';
chatWorkaround = function(message, who, spell=undefined)
{
    if(spell !== undefined){
        let ability = findObjs({ type:"ability", _characterid: spell.caster.character.id, name: 'spell_genius_temp'})[0];
        if(ability === undefined) {
            createObj("ability", {
                name: 'spell_genius_temp',
                characterid: spell.caster.character.id,
                istokenaction: false,
                action: message
            });
        }else{
            ability.set('action', message);
        }
        sendChat(who, '/w \"'+who+'\" [Cast *'+spell.spellname+'* Now](~'+spell.caster.character.id+'|spell_genius_temp)');
    }else {
        sendChat(who, message);
    }
};

sendMessage = function(message, who="spellgen", caster) {
    chatWorkaround(message, who, caster);
};

get_token = function(id) {
    let token = findObjs({
        _pageid:  Campaign().get("playerpageid"),
        _type:    "graphic",
        _id:      id
    })[0];
    if(token === undefined){
        token = _.chain(findObjs({ _pageid:  Campaign().get("playerpageid"), type:"graphic"}))
            .filter((o)=>o.get('represents')===id)
            .value()[0];
    }
    return token;
};

get_char = function(token) {
    return getObj("character", token.get('represents'));
};

get_name = function(char, alt = "target") {
    if(char === undefined){
        return alt;
    }
    let name = char.get('name');
    if(name === undefined){
        name = alt;
    }
    return name;
};

get_attr = function(char, attr) {
    if(char === undefined){
        return null;
    }
    return getAttrByName(char.id, attr);
};

meta_list = function(msg){
    let ret = [];
    Object.entries(meta_feats).forEach(
        ([key, feat]) => {
            if(msg.includes(key)){
                ret.push('['+feat['tag']+']('+feat['url']+') ');
            }
        });
    return ret;
};


get_meta_effects = function(msg){
    let ret = {};
    if(msg === undefined){
        return ret;
    }
    Object.entries(meta_feats).forEach(
        ([key, feat]) => {
            ret[key] = msg.includes(key);
        });
    return ret;
};

spell_gen = function(msg_orig) {
    let msg = msg_orig.content;
    let who = msg_orig.who;
    let arr = msg.split(/\s+/);
    if(arr.length < 4) return;
    //meta
    let meta_effect = get_meta_effects(msg);
    let metas = meta_list(msg);


    let spell = arr[1];
    let caster_id = arr[2];
    let target_id = arr[3];
    let to_gm = (arr[4]>0);

    if(spell in spells){
        spell = spells[spell](caster_id, target_id, meta_effect, metas);
        if(spell.sudden_check(meta_effect) || disable_sudden_check) {
            let macro = gen_macro(spell);
            let caster = create_creature(caster_id);
            if(to_gm){
                macro = "/w gm "+macro;
            }
            if(spell.fx !== undefined){
                macro += '\n!spell_fx '+arr[1]+' '+caster_id+' '+target_id;
            }
            macro += spell.sudden_decr(meta_effect);
            if(spell.gm_command !== undefined){
                macro += "\n/w gm "+spell.gm_command;
            }
            msg_orig.content = '!spell_genius '+arr[1];
            spell_genius(msg_orig);
            if(disable_sudden_check && !spell.sudden_check(meta_effect)){
                sendMessage('/w \"'+who+'\" **Meta Feats not Available:**'+spell.sudden_problem(meta_effect), msg_orig.who);
            }
            sendMessage(macro, who, spell);
        } else
        {
            sendMessage('/w \"'+who+'\" **Meta Feats not Available:**'+spell.sudden_problem(meta_effect), msg_orig.who);
        }
    }
};

spell_macro = function(msg_orig) {
    if(msg_orig.selected === undefined){
        sendMessage('/w \"'+msg_orig.who+'\" Error: no token selected', msg_orig.who);
        return;
    }
    let msg = msg_orig.content;
    let arr = msg.split(/\s+/);
    let spell = arr[1];
    let caster_id = arr[2];
    if(spell in spells) {
        let caster = create_creature(caster_id);
        let macro_head;
        let macro_tail = "";
        if(no_target.includes(spell)){
            macro_head = "!spell_gen "+spell+" @{character_id} @{character_id} ?{Whisper to GM?|No,0|Yes,1} ";
        }else{
            macro_head = "!spell_gen "+spell+" @{character_id} @{target|token_id} ?{Whisper to GM?|No,0|Yes,1} ";
        }

        let meta_effects = get_meta_effects(caster.get_attr('meta_feats'));
        let compatible_feats = spells[spell](msg_orig.selected[0]['_id'], msg_orig.selected[0]['_id'], get_meta_effects(msg_orig.content), '', info='feats');
        Object.entries(meta_effects).forEach(
            ([key, value]) => {
                if(value) {
                    if(compatible_feats.includes(key))
                        macro_tail += " ?{"+key+"|No,''|Yes,"+key+"}";
                }
            });
        let ability = findObjs({ type:"ability", _characterid: caster.character.id, name: spell})[0];
        if(ability === undefined){
            ability = createObj("ability", {
                name: spell,
                characterid: caster.character.id,
                istokenaction: true
            });
        }
        ability.set('action', macro_head+macro_tail);
        sendMessage('/w \"'+msg_orig.who+'\" **Spell added:** *'+spell+'*', msg_orig.who);
    }
};

spell_list = function(msg_orig){
    if(msg_orig.selected === undefined){
        sendMessage('/w \"'+msg_orig.who+'\" Error: no token selected', msg_orig.who);
        return;
    }

    let spells_str = '';
    let keys = Object.keys(spells);
    keys.sort();
    _.each(keys, function(key){
        let spell = spells[key];
        spells_str += spell(msg_orig.selected[0]['_id'], msg_orig.selected[0]['_id'], get_meta_effects(msg_orig.content), '', 'list')+' [Add Spell](!spell_macro '+key+' '+msg_orig.selected[0]['_id']+') ' + '<br>';
    });
    sendMessage('/w \"'+msg_orig.who+'\" **Spell List:**<br>' + spells_str, msg_orig.who);
};

spell_fx = function(msg_orig){
    let msg = msg_orig.content;
    let arr = msg.split(/\s+/);
    if(arr.length < 2) return;

    let spell = arr[1];
    let caster_id = arr[2];
    let target_id = (arr.length>2)? arr[3] : arr[2];
    if(spell in spells) {
        spell = spells[spell](caster_id, target_id, {}, '');
        if (spell.fx['custom'] === undefined) {
            if (spell.fx['line']) {
                spawnFxBetweenPoints({x: spell.fx['from_x'], y: spell.fx['from_y']}, {
                    x: spell.fx['to_x'],
                    y: spell.fx['to_y']
                }, spell.fx['effect']);
            } else {
                spawnFx(spell.fx['from_x'], spell.fx['from_y'], spell.fx['effect']);
            }
        }else{
            spawnFxWithDefinition(spell.fx['from_x'], spell.fx['from_y'], spell.fx['custom']);
        }
    }
};

spell_feats = function(msg_orig){
    if(msg_orig.selected === undefined){
        sendMessage('/w \"'+msg_orig.who+'\" Error: no token selected', msg_orig.who);
        return;
    }
    let msg = msg_orig.content;
    let arr = msg.split(/\s+/);
    if(arr.length === 1 ) {
        let feats_str = '';
        let keys = Object.keys(meta_feats);
        keys.sort();
        _.each(keys, function(key){
            let feat = meta_feats[key];
            feats_str += '['+feat.name+']('+feat.url+') [Add Feat](!spell_feats '+key+') ' + '<br>';
        });
        sendMessage('/w \"'+msg_orig.who+'\" **Feat List:**<br>' + feats_str, msg_orig.who);
    }
    else if (arr.length === 2) {
        let feat = arr[1];
        let caster = create_creature(msg_orig.selected[0]['_id']);
        let feats_obj = findObjs({ _characterid: caster.character.id, _type: "attribute", name: 'meta_feats'})[0];
        if(feat === 'list'){
            let feat_arr = feats_obj.get('current').split(', ');
            let feat_list = '';
            Object.entries(feat_arr).forEach(
                ([key, feat]) => {
                    if(feat !== '' && feat in meta_feats){
                        feat_list += '['+meta_feats[feat]['name']+']('+meta_feats[feat]['url']+')<br>';
                    }
                });
            sendMessage('/w \"'+msg_orig.who+'\" **Feats on Character:** *'+feat_list+'*', msg_orig.who);
            return;
        }
        let feats = '';
        if(feats_obj === undefined){
            feats_obj = createObj("attribute", {
                name: 'meta_feats',
                characterid: caster.character.id,
            });
        }else {
            feats = feats_obj.get('current');
        }
        if (feat in meta_feats && !feats.includes(feat)){
            if(feats === '') {
                feats = feat;
            } else {
                feats = feat+', '+feats ;
            }

            feats_obj.set('current', feats);
            sendMessage('/w \"'+msg_orig.who+'\" **Feat added:** *'+feat+'*', msg_orig.who);
            if(!feat.includes('sudden_')) return;

            let feat_arr = feats.split(', ');
            let rest = '';
            Object.entries(feat_arr).forEach(
                ([key, feat]) => {
                    if(feat !== '' && feat.includes('sudden_')){
                        feats_obj = findObjs({ _characterid: caster.character.id, _type: "attribute", name: feat})[0];
                        if(feats_obj === undefined){
                            createObj("attribute", {
                                name: feat,
                                characterid: caster.character.id,
                                current: '1',
                                max:    '1'
                            });
                        }
                        if(rest === ''){
                            rest = '!setattr  --charid '+caster.character.id;
                        }
                        rest += ' --'+feat+'|1';
                    }
                });
            if(rest !== ''){
                let ability = findObjs({ type:"ability", _characterid: caster.character.id, name: 'rest'})[0];
                if(ability === undefined){
                    ability = createObj("ability", {
                        name: 'rest',
                        characterid: caster.character.id,
                        istokenaction: true
                    });
                }
                ability.set('action', rest);
            }
        }
    }

};

spell_genius = function(msg_orig){
    let msg = msg_orig.content;
    let arr = msg.split(/\s+/);
    if(arr.length === 1 ) {
        let ret = ' <br>**-Spell Genius-**<br>';
        ret += '[Spells](!spell_list)<br>';
        ret += '[Feats](!spell_feats)';
        sendMessage('/w \"'+msg_orig.who+'\" '+ret, msg_orig.who);
    }
    else if(arr.length > 1){
        if(arr[1] in meta_feats){
            let feat = meta_feats[arr[1]];
            let msg = '<br>**['+feat['name']+']('+feat['url']+')**<br>';
            msg += 'uses per day: '+((feat['per_day'] === undefined)? 'unlimited' : feat['per_day']);
            if(msg_orig.selected !== undefined){
                let caster = create_creature(msg_orig.selected[0]['_id']);
                let attribute = findObjs({ type:"attribute", _characterid: caster.character.id, name: arr[1]})[0];
                if(attribute !== undefined){
                    msg += '<br>uses left: '+attribute.get('current')+'/'+attribute.get('max');
                }
            }
            let feat_notes = feat['notes'].replace(/\)/g, '&#41;');
            feat_notes = feat_notes.replace(/]/g, '&#93;');
            msg +=  '<br> [description](!&#13;/w '+msg_orig.who+' <br>'+feat_notes+')';
            sendMessage('/w \"'+msg_orig.who+'\" '+msg, msg_orig.who);
        }
        if(arr[1] === 'list_feats'){
            if(msg_orig.selected === undefined){
                sendMessage('/w \"'+msg_orig.who+'\" Error: no token selected', msg_orig.who);
                return;
            }
            let caster = create_creature(msg_orig.selected[0]['_id']);
            let feats = caster.get_attr('meta_feats').split(', ');
            feats.sort();
            for(const feat of feats){
                msg_orig.content = '!spell_genius '+feat;
                spell_genius(msg_orig);
            }

        }
        else if(arr[1] in spells) {
            if(msg_orig.selected === undefined){
                sendMessage('/w \"'+msg_orig.who+'\" Error: no token selected', msg_orig.who);
                return;
            }
            let spell = spells[arr[1]](msg_orig.selected[0]['_id'], msg_orig.selected[0]['_id'], get_meta_effects(msg_orig.content), '', 'list');
            let mat_comp = spells[arr[1]](msg_orig.selected[0]['_id'], msg_orig.selected[0]['_id'], get_meta_effects(msg_orig.content), '', 'mat_comp');
            let msg = '<br> **' + spell+'**'+
                ((mat_comp.m === undefined) ? '' : '<br> **material component**:' + mat_comp.m) +
                ((mat_comp.f === undefined) ? '' : '<br> **focus component**:' + mat_comp.f);
            sendMessage('/w \"'+msg_orig.who+'\" '+msg, msg_orig.who);
        }
    }
};

HandleInput = function(msg_orig) {
    try {
        if (msg_orig.type !== "api") {
            return;
        }
        if (msg_orig.who.includes('(GM)')) {
            msg_orig.who = "gm";
        }
        if (msg_orig.content.startsWith("!spell_genius")) {
            spell_genius(msg_orig);
        } else if (msg_orig.content.startsWith("!spell_gen")) {
            spell_gen(msg_orig);
        } else if (msg_orig.content.startsWith("!spell_macro")) {
            spell_macro(msg_orig);
        } else if (msg_orig.content.startsWith("!spell_list")) {
            spell_list(msg_orig);
        } else if (msg_orig.content.startsWith("!spell_fx")) {
            spell_fx(msg_orig);
        } else if (msg_orig.content.startsWith("!spell_feats")) {
            spell_feats(msg_orig);
        }
    }
    catch(error){
        log(error);
    }


};


RegisterEventHandlers = function() {
    on('chat:message', HandleInput);
};
checkInstall = function(){
    let error = [];
    let run = true;
    if(!state.ChatSetAttr){
        error.push('Error: ChatSetAttr script needed.');
        run = false;
    }
    if(!state.TokenMod){
        error.push('Error: TokenMod script needed.');
        run = false;
    }

    for(err of error){
        log(err);
    }
    return run;
};

on("ready",function() {
    'use strict';
    if (checkInstall()) {
        RegisterEventHandlers();
        log('-=> SpellGenius '+version+' <=-');
    }
});

create_creature = function(id){
    let token = get_token(id);
    let character = get_char(token);
    return {
        token       : token,
        character   : character,
        name        : get_name(character),
        casterlevel : get_attr(character, 'casterlevel'),
        casterlevel2: get_attr(character, 'casterlevel'),
        get_attr    : function(attr) {return get_attr(character, attr)},
        set_attr    : function(attr, val) {findObjs({ _characterid: character.id, _type: "attribute", name: attr})[0].set(attr, val)},
        mod_attr    : function(attr, val) {
            let old = findObjs({ _characterid: character.id, _type: "attribute", name: attr})[0];
            let new_val = parseInt(old.get('current'))+parseInt(val);
            if(new_val < 0) new_val = 0;
            old.set('current', new_val);

        }
    };
};

create_spell = function(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx=undefined, gm_command=undefined){
    return {
        spellname   : spellname,
        caster      : caster,
        target      : target,
        spell_tag   : spell_tag,
        school      : school,
        level       : level,
        meta        : meta,
        comp        : comp,
        cast_time   : cast_time,
        range       : range,
        duration    : duration,
        effect      : effect,
        saving_throw: saving_throw,
        spell_resist: spell_resist,
        ranged_touch: ranged_touch,
        notes       : notes,
        fx          : fx,
        gm_command  : gm_command,
        sudden_decr : function(meta_effects){
            let ret = '';
            Object.entries(meta_effects).forEach(
                ([key, value]) => {
                    if(value && key.includes('sudden_')) {
                        //caster.mod_attr(key, -1);
                        if(ret === ''){
                            ret = '\n!setattr --charid '+caster.character.id;
                        }
                        ret += ' --'+key+'|0'
                    }
                });
            return ret;
        },
        sudden_check: function(meta_effects){
            let ret = true;
            Object.entries(meta_effects).forEach(
                ([key, value]) => {
                    if(value && key.includes('sudden_')) {
                        ret &= (parseInt(caster.get_attr(key))>0);
                    }
                });
            return ret;
        },
        sudden_problem: function(meta_effects){
            let ret = [];
            Object.entries(meta_effects).forEach(
                ([key, value]) => {
                    if(value && key.includes('sudden_')) {
                        if(parseInt(caster.get_attr(key))<=0){
                            ret.push(key);
                        }
                    }
                });
            return ret;
        }
    };
};

gen_macro = function(spell){
    let ret                                      = "&{template:DnD35StdRoll} {{spellflag=true}}";
    if(spell.caster.name !== undefined)     ret += "{{name="+spell.caster.name+"}}";
    if(spell.spell_tag !== undefined)       ret += "{{subtags="+spell.spell_tag+"}}";
    if(spell.school !== undefined)          ret += "{{School:="+spell.school+"}}";
    if(spell.level !== undefined)           ret += "{{Level:= "+spell.level+"}}";
    if(spell.meta !== undefined)            ret += "{{Meta:="+spell.meta+"}}";
    if(spell.comp !== undefined)            ret += "{{Comp:="+spell.comp+"}}";
    if(spell.cast_time !== undefined)       ret += "{{Cast Time:= "+spell.cast_time+"}}";
    if(spell.range !== undefined)           ret += "{{Range:= "+spell.range+" }}";
    if(spell.target.name !== undefined)     ret += "{{Target:= "+spell.target.name+"}}";
    if(spell.ranged_touch !== undefined)    ret += "{{Ranged Touch:= "+spell.ranged_touch+"}}";
    if(spell.duration !== undefined)        ret += "{{Dur:= "+spell.duration+"}}";
    if(spell.saving_throw !== undefined)    ret += "{{Save:= "+spell.saving_throw+"}}";
    if(spell.spell_resist !== undefined)    ret += "{{SR:= "+spell.spell_resist+"}}";
    if(spell.effect !== undefined)    ret += "{{Effect:= "+spell.effect+"}}";
    if(spell.notes !== undefined)           ret += "{{notes= "+spell.notes+"}}";
    return ret;
};


//meta feats
const meta_feats = {
    'widen_spell'   : {
        'name': 'Widen Spell',
        'tag': 'widen',
        'url': 'https://dndtools.net/feats/tome-and-blood-a-guidebook-to-wizards-and-sorcerers--51/widen-spell--3628/',
        'per_day': undefined,
        'notes': 'You can alter a burst, emanation, line, or spread shaped spell to increase its area. ' +
            'Any numeric measurements of the spell\'s area increase by 100%. For example, a fireball spell ' +
            '(which normally produces a 20-foot-radius spread) that is widened now fills a 40-footradius spread. ' +
            'A widened spell uses up a spell slot three levels higher than the spell\'s actual level. ' +
            'Spells that do not have an area of one of these four sorts are not affected by this feat.'
    },
    'empower_spell'   : {
        'name': 'Empower Spell',
        'tag': 'empower',
        'url': 'https://dndtools.net/feats/players-handbook-v35--6/empower-spell--848/',
        'per_day': undefined,
        'notes': 'All variable, numeric effects of an empowered spell are increased by one-half. ' +
            'An empowered spell deals half again as much damage as normal, cures half again ' +
            'as many hit points, affects half again as many targets, and so forth, as appropriate. ' +
            'For example, an empowered magic missile deals 1-1/2 times its normal damage ' +
            '(roll 1d4+1 and multiply the result by 1-1/2 for each missile). Saving throws and ' +
            'opposed rolls (such as the one you make when you cast dispel magic) are not affected, ' +
            'nor are spells without random variables. An empowered spell uses up a spell slot two levels ' +
            'higher than the spell\'s actual level.'
    },
    'enlarge_spell'   : {
        'name': 'Enlarge Spell',
        'tag': 'enlarge',
        'url': 'https://dndtools.net/feats/players-handbook-v35--6/enlarge-spell--897/',
        'per_day': undefined,
        'notes': 'You can alter a spell with a range of close, medium, or long to increase its range by 100%. ' +
            'An enlarged spell with a range of close now has a range of 50 ft. + 5 ft./level, while ' +
            'medium-range spells have a range of 200 ft. + 20 ft./level and long-range spells have a range ' +
            'of 800 ft. + 80 ft./level. An enlarged spell uses up a spell slot one level higher than the spell\'s ' +
            'actual level. Spells whose ranges are not defined by distance, as well as spells whose ranges are not ' +
            'close, medium, or long, do not have increased ranges.'
    },
    'extend_spell'   : {
        'name': 'Extend Spell',
        'tag': 'extend',
        'url': 'https://dndtools.net/feats/players-handbook-v35--6/extend-spell--1006/',
        'per_day': undefined,
        'notes': 'An extended spell lasts twice as long as normal. A spell with a duration of concentration, ' +
            'instantaneous, or permanent is not affected by this feat. An extended spell uses up a spell slot one ' +
            'level higher than the spell\'s actual level.'
    },
   /** 'heighten_spell'   : {
        'name': 'Heighten Spell',
        'tag': 'heighten',
        'url': 'https://dndtools.net/feats/players-handbook-v35--6/heighten-spell--1371/',
        'per_day': undefined,
        'notes': 'A heightened spell has a higher spell level than normal (up to a maximum of 9th level). ' +
            'Unlike other metamagic feats, Heighten Spell actually increases the effective level of the spell ' +
            'that it modifies. All effects dependent on spell level (such as saving throw DCs and ability to ' +
            'penetrate a lesser globe of invulnerability) are calculated according to the heightened level. ' +
            'The heightened spell is as difficult to prepare and cast as a spell of its effective level. For ' +
            'example, a cleric could prepare hold person as a 4th-level spell (instead of a 2nd-level spell), ' +
            'and it would in all ways be treated as a 4th-level spell.'
    },**/
    'maximize_spell'   : {
        'name': 'Maximize Spell',
        'tag': 'maximize',
        'url': 'https://dndtools.net/feats/players-handbook-v35--6/maximize-spell--1913/',
        'per_day': undefined,
        'notes': 'All variable, numeric effects of a spell modified by this feat are maximized. A maximized ' +
            'spell deals maximum damage, cures the maximum number of hit points, affects the maximum number of ' +
            'targets, etc., as appropriate. For example, a maximized fireball deals 6 points of damage per ' +
            'caster level (up to a maximum of 60 points of damage at 10th caster level). Saving throws and ' +
            'opposed rolls (such as the one you make when you cast dispel magic) are not affected, nor are ' +
            'spells without random variables. A maximized spell uses up a spell slot three levels higher than ' +
            'the spell\'s actual level. An empowered, maximized spell gains the separate benefits of each ' +
            'feat the maximum result plus one-half the normally rolled result. An empowered, maximized ' +
            'fireball cast by a 15th-level wizard deals points of damage equal to 60 plus one half of 10d6.'
    },
    'quicken_spell'   : {
        'name': 'Quicken Spell',
        'tag': 'quicken',
        'url': 'https://dndtools.net/feats/players-handbook-v35--6/quicken-spell--2330/',
        'per_day': undefined,
        'notes': 'Casting a quickened spell is a free action. You can perform another action, ' +
            'even casting another spell, in the same round as you cast a quickened spell. You may ' +
            'cast only one quickened spell per round. A spell whose casting time is more than 1 ' +
            'full-round action cannot be quickened. A quickened spell uses up a spell slot four levels ' +
            'higher than the spell\'s actual level. Casting a quickened spell doesn\'t provoke an attack ' +
            'of opportunity.'+
            'This feat can\'t be applied to any spell cast spontaneously (including sorcerer spells, ' +
            'bard spells, and cleric or druid spells cast spontaneously), since applying a metamagic ' +
            'feat to a spontaneously cast spell automatically increases the casting time to a full-round action.'
    },
    'silent_spell'   : {
        'name': 'Silent Spell',
        'tag': 'silent',
        'url': 'https://dndtools.net/feats/players-handbook-v35--6/silent-spell--2626/',
        'per_day': undefined,
        'notes': 'A silent spell can be cast with no verbal components. Spells without verbal components are ' +
            'not affected. A silent spell uses up a spell slot one level higher than the spell\'s actual level. ' +
            'Bard spells cannot be enhanced by this metamagic feat.'
    },
    'still_spell'   : {
        'name': 'Still Spell',
        'tag': 'still',
        'url': 'https://dndtools.net/feats/players-handbook-v35--6/still-spell--2771/',
        'per_day': undefined,
        'notes': 'A stilled spell can be cast with no somatic components. Spells without somatic components ' +
            'are not affected. A stilled spell uses up a spell slot one level higher than the spell\'s actual level.'
    },
    'sudden_empower'   : {
        'name': 'Sudden Empower',
        'tag': 'sudden empower',
        'url': 'https://dndtools.net/feats/complete-arcane--55/sudden-empower--2813/',
        'per_day': 1,
        'notes': 'Once per day, you can apply the effect of the ' +
            '[Empower Spell](https://dndtools.net/feats/players-handbook-v35--6/empower-spell--848/) feat ' +
            'to any spell you cast without increasing the level of the spell or specially ' +
            'preparing it ahead of time. You can still use Empower Spell normally if you have it'
    },
    'sudden_enlarge'   : {
        'name': 'Sudden Enlarge',
        'tag': 'sudden enlarge',
        'url': 'https://dndtools.net/feats/miniatures-handbook--75/sudden-enlarge--2816/',
        'per_day': 1,
        'notes': 'Once per day, you may apply the ' +
            '[Enlarge Spell](https://dndtools.net/feats/players-handbook-v35--6/enlarge-spell--897/) ' +
            'feat to any spell you cast, without increasing the level of the spell or specially ' +
            'preparing it ahead of time. You may still use the Enlarge Spell feat normally, if you have it.'
    },
    'sudden_extend'   : {
        'name': 'Sudden Extend',
        'tag': 'sudden extend',
        'url': 'https://dndtools.net/feats/complete-arcane--55/sudden-extend--2817/',
        'per_day': 1,
        'notes': 'Once per day, you can apply the effect of the ' +
            '[Extend Spell](https://dndtools.net/feats/players-handbook-v35--6/extend-spell--1006/) ' +
            'feat to any spell you cast without increasing the level of the spell or specially ' +
            'preparing it ahead of time. You can still use Extend Spell normally if you have it.'
    },
    'sudden_maximize'   : {
        'name': 'Sudden Maximize',
        'tag': 'sudden maximize',
        'url': 'https://dndtools.net/feats/complete-arcane--55/sudden-maximize--2819/',
        'per_day': 1,
        'notes': 'Once per day, you can apply the effect of the ' +
            '[Maximize Spell](https://dndtools.net/feats/players-handbook-v35--6/maximize-spell--1913/) ' +
            'feat to any spell you cast without increasing the level of the spell or specially ' +
            'preparing it ahead of time. You can still use Maximize Spell normally if you have it.'
    },
    'sudden_quicken'   : {
        'name': 'Sudden Quicken',
        'tag': 'sudden quicken',
        'url': 'https://dndtools.net/feats/complete-arcane--55/sudden-quicken--2821/',
        'per_day': 1,
        'notes': 'Once per day, you can apply the effect of the ' +
            '[Quicken Spell](https://dndtools.net/feats/players-handbook-v35--6/quicken-spell--2330/) ' +
            'feat to any spell you cast without increasing the level of the spell or specially preparing it ' +
            'ahead of time. You can still use Quicken Spell normally.'
    },
    'sudden_silent'   : {
        'name': 'Sudden Silent',
        'tag': 'sudden silent',
        'url': 'https://dndtools.net/feats/complete-arcane--55/sudden-silent--2824/',
        'per_day': 1,
        'notes': 'Once per day, you can apply the effect of the ' +
            '[Silent Spell](https://dndtools.net/feats/players-handbook-v35--6/silent-spell--2626/) ' +
            'feat to any spell you cast without increasing the level of the spell or specially ' +
            'preparing it ahead of time. You can still use Silent Spell normally if you have it.'
    },
    'sudden_still'   : {
        'name': 'Sudden Still',
        'tag': 'sudden_still',
        'url': 'https://dndtools.net/feats/complete-arcane--55/sudden-still--2826/',
        'per_day': 1,
        'notes': 'Once per day, you can apply the effect of the ' +
            '[Still Spell](https://dndtools.net/feats/players-handbook-v35--6/still-spell--2771/) ' +
            'feat to any spell you cast without increasing the level of ' +
            'the spell or specially preparing it ahead of time. You can still ' +
            'use Still Spell normally if you have it.'
    },
    'sudden_widen'  : {
        'name': 'Sudden Widen',
        'tag': 'sudden_widen',
        'url': 'https://dndtools.net/feats/complete-arcane--55/sudden-widen--2828/',
        'per_day': 1,
        'notes': 'Once per day, you can apply the effect of the [Widen Spell]' +
            '(https://dndtools.net/feats/tome-and-blood-a-guidebook-to-wizards-and-sorcerers--51/widen-spell--3628/) ' +
            'feat to any spell you cast without increasing the level of the spell or specially preparing it ahead of ' +
            'time. You can still use Widen Spell normally if you have it.'
    }
};



sudden_helper = function(meta_effect){
    Object.entries(meta_effect).forEach(
        ([key, value]) => {
            if(key.includes('sudden') && value) {
                let arr = key.split('_');
                let feat = arr[1]+'_spell';
                if(feat in meta_effect){
                    meta_effect[feat] = true;
                }
            }
        });
    return meta_effect;
};

calc_angle = function(from, to) {
    let angle = 90 - Math.round(Math.atan2( to.x - from.x, to.y - from.y) * 180 / Math.PI);
    if(angle < 0) angle += 360;
    if(angle > 360) angle -=360;
    return angle;
};

calc_distance = function(from, to){
    let a = from.x - to.x;
    a *= a;
    let b = from.y - to.y;
    b *= b;
    return Math.sqrt(a+b);
};

//Spells
read_magic = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Read Magic";
    let url         = "http://www.dandwiki.com/wiki/SRD:Read_Magic";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A clear crystal or mineral prism.'
        };
    }
    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Div";
    let level       = "Brd 0, Clr 0, Drd 0, Pal 1, Rgr 1, Sor/Wiz 0";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = 10*caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "You can decipher magical inscriptions that would otherwise be unintelligible.                                                    \
                       This does not normally invoke the magic contained in the writing, although it may do so in the case of a cursed scroll.          \
                       You can read at the rate of one page (250 words) per minute. Identify a glyph of warding with a DC 13 Spellcraft check,          \
                       a greater glyph of warding with a DC 16 Spellcraft check, or any symbol spell with a Spellcraft check (DC 10 + spell level).";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

lesser_orb_fire = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Lesser Orb of Fire";
    let url         = "https://www.dandwiki.com/wiki/Orb_of_Fire,_Lesser_(3.5e_Spell&#41;";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'maximize_spell', 'sudden_maximize',
        'empower_spell', 'sudden_empower',
        'enlarge_spell', 'sudden_enlarge'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: undefined
        };
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);

    if(target.name === undefined){
        target.name = 'creature';
    }

    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Con [Creation] (fire)";
    let level       = "Sor/Wiz 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*(Math.floor(caster.casterlevel/2))) +"ft";
    let duration    = 'Instantaneous';
    let effect      = 'One orb of fire';
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= "[[1d20 + "+caster.get_attr('bab')+'+'+caster.get_attr('dex-mod')+"]]";
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '[[floor('+((1+Math.min(Math.floor((caster.casterlevel-1)/2),5))*8)+' + ('+(1+Math.min(Math.floor((caster.casterlevel-1)/2),5))+'d8 * 0.5))]] ';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '[['+(1+Math.min(Math.floor((caster.casterlevel-1)/2),5))*8+']] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += '[[floor('+(1+Math.min(Math.floor((caster.casterlevel-1)/2),5))+'d8 * 1.5)]] ';
    }else{  //no maximze and no empower
        checkroll += '[['+(1+Math.min(Math.floor((caster.casterlevel-1)/2),5))+'d8]] ';
    }


    let notes  = "An orb of fire about 2 inches across shoots from **"+caster.name+"'s** palm at " +
        "**"+target.name+"**, dealing "+checkroll+" points of fire damage. You must succeed on a ranged touch " +
        "attack to hit your target. Dealing 1d8 points of fire damage. For every 2 caster levels beyond 1st, " +
        "your orb deals additional 1d8 points of damage: 2d8 at 3rd level, 3d8 at 5th level, 4d8 at 7th level, " +
        "and the maximum of 5d8 at 9th level or higher.";
    let fx_speed    = 20;
    let fx_duration = Math.round(calc_distance({ x : caster.token.get('left'), y : caster.token.get('top')},
        { x : target.token.get('left'), y : target.token.get('top')})/fx_speed);
    let fx          =  {
        'from_x'    : caster.token.get('left'),
        'from_y'    : caster.token.get('top'),
        'effect'    : undefined,
        'to_x'      : target.token.get('left'),
        'to_y'      : target.token.get('top'),
        'custom'    : {
            "angleRandom": -1,
            "duration": fx_duration,
            "emissionRate": 600,
            "endColour": [255, 223, 94, 1],
            "endColourRandom": [30, 20, 0, 0],
            "lifeSpan": fx_duration,
            "lifeSpanRandom": -1,
            "maxParticles": 1,
            "size": 25,
            "gravity": {x : 0.0, y: 0.0},
            "sizeRandom": -1,
            "speed": fx_speed,
            "speedRandom": -1,
            "startColour": [255, 223, 94, 1],
            "startColourRandom": [30, 20, 0, 0],
            "angle": calc_angle({ x : caster.token.get('left'), y : caster.token.get('top')},
                { x : target.token.get('left'), y : target.token.get('top')}),
        },
        'line'      : true
    };
    let gm_command  =  'Attackroll success -> [Effect](!&#13;/fx burn-fire '+target_id+')';

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

dimension_door = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Dimension Door";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/dimension-door--2388/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'enlarge_spell', 'sudden_enlarge'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: undefined
        };
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Con (Teleportation)";
    let level       = " Trapsmith 2, Telflammar Shadowlord 3, Bard 4, Savant 4 (Arcane), " +
        "Jester 4, Death Master 4, Sha'ir 4, Wu Jen 4 (Earth), Duskblade 4, Court Herald 4, " +
        "Slayer of Domiel 4, Ebonmar Infiltrator 4, Hoardstealer 4, Wizard 4, Sorcerer 4, " +
        "Runescarred Berserker 5, Knight of the Weave 5, Travel 4, Portal (Alternative) 4, Portal 4";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Long: "+((400*((meta_effect.enlarge_spell)? 2 : 1))+40*caster.casterlevel)+"ft";
    let duration    = 'Instantaneous';
    let effect      = 'You and touched objects or up to '+(Math.floor(caster.casterlevel/3))+' other touched willing creatures(Medium) teleport.';
    let saving_throw= "None and Will negates (object)<br>(DC: [[@{spelldc4}+@{sf-conjuration}]])";
    let spell_resist= "No and Yes (object)<br>(DC: [[ 1d20+@{casterlevel2}+@{spellpen} ]]";
    let ranged_touch= undefined;
    let notes       = "You instantly transfer yourself from your current location to any other spot within range. " +
        "After using this spell, you can't take any other actions until your next turn. You can bring along " +
        "objects as long as their weight doesn't exceed your maximum load. You may also bring one additional " +
        "willing Medium or smaller creature (carrying gear or objects up to its maximum load) or its equivalent " +
        "per three caster levels. A Large creature counts as two Medium creatures, a Huge creature counts as two " +
        "Large creatures, and so forth. All creatures to be transported must be in contact with one another, and " +
        "at least one of those creatures must be in contact with you.";

    let fx          = undefined;
    let gm_command  =  'Select token to apply effect. Only select 1 token each time.<br>**Vanish** will move the selected token to the gm layer.<br>**Appear** will move ' +
        'the selected token to the object layer.<br>First use **Vanish**, then move the token (on the gm layer) to the new position and use **Appear**.<br>' +
        'Switch between Layer shortcuts:<br>(**CTRL+O**:Object/Tokens layer)<br>(**CTRL+K**: GM layer)<br>' +
        '[Vanish](!&#13;/fx nova-magic&#13;!token-mod --set layer|gmlayer)'+
        '[Appear](!&#13;/fx nova-magic&#13;!token-mod --set layer|objects)';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

burning_blood = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Burning Blood";
    let url         = "https://dndtools.net/spells/complete-arcane--55/burning-blood--522/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'maximize_spell', 'sudden_maximize',
        'empower_spell', 'sudden_empower',
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }
    if(info === 'mat_comp'){
        return {
            m: 'A drop of blood and a pinch of saltpeter.',
            f: undefined
        };
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);

    if(target.name === undefined){
        target.name = 'creature';
    }

    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Necromancy";
    let level       = "Sor/Wiz 4";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'M';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +"ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds';
    let effect      = 'You taint a living creature\'s blood';
    let saving_throw= "Fortitude partial(see text)<br>(DC: [[@{spelldc4}+@{sf-necromancy}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '8+(1d8&#42;0.5&#41;';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '8';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += '1d8&#42;1.5';
    }else{  //no maximze and no empower
        checkroll += '1d8';
    }



    let notes  = "You taint a living creature's blood with a hot, corrosive infusion, dealing "+checkroll+" points of " +
        "acid damage and "+checkroll+" points of fire damage per round. The subject can attempt a Fortitude save each " +
        "round to negate the damage, but a successful save does not prevent damage in future rounds. Searing " +
        "pain limits the subject to a single move action in any round when it fails its Fortitude save. " +
        "Burning blood does not affect creatures of the construct, elemental, ooze, plant, or undead types.";

    let fx_speed    = undefined;
    let fx_duration = undefined;
    let fx          =  undefined;
    let gm_command  =  '[Roll damage (click each round)](!&#13;/w gm [[floor('+checkroll+'&#41;&#93;&#93; **acid damage** &#13;/w gm [[floor('+checkroll+'&#41;&#93;&#93; **fire damage** &#13;/fx burn-blood '+target_id+')';

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

defenestrating_sphere = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Defenestrating Sphere";
    let url         = "https://dndtools.net/spells/complete-arcane--55/defenestrating-sphere--493/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A gray pearl worth at least 100 gp.'
        };
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'maximize_spell', 'sudden_maximize',
        'empower_spell', 'sudden_empower',
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);

    if(target.name === undefined){
        target.name = 'creature';
    }

    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Evocation (Air)";
    let level       = "Sor/Wiz 4";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'F';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +"ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds';
    let effect      = '2-ft.-radius sphere';
    let saving_throw= "Fortitude partial(see text)<br>(DC: [[@{spelldc4}+@{sf-necromancy}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let checkroll1   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll1 += '18+(3d6&#42;0.5&#41;';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll1 += '18';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll1 += '3d6&#42;1.5';
    }else{  //no maximze and no empower
        checkroll1 += '3d6';
    }
    let checkroll2   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll2 += '8+(1d8&#42;0.5&#41;&#42;10';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll2 += '80';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll2 += '1d8&#42;1.5&#42;10';
    }else{  //no maximze and no empower
        checkroll2 += '1d8&#42;10';
    }


    let notes  = "A cloudy gray sphere of whirling air and howling wind flies to attack your enemies and hurl them to " +
        "the sky. As a move action, you can make the sphere **travel up to 30 feet per round** and strike the creature or " +
        "object you indicate as a **ranged touch attack**. Any creature **struck** by the sphere takes **"+checkroll1+"** points of damage " +
        "from the force of its winds. In addition, **Medium or smaller** creatures must succeed on a **Fortitude save** or " +
        "be knocked prone. Creatures that fall prone must then succeed on a **second Fortitude save** or be swept up by " +
        "the sphere and driven **"+checkroll2+"** feet into the air, dropping **1d6 squares** from their original position in a **random** " +
        "direction and taking falling damage as normal. If some **obstacle** prevents the target creature from reaching " +
        "its expelled height, it takes **1d6** points of damage for every **10 feet** of movement it was unable to complete, " +
        "so that a creature hurled 50 feet up in a room with a 20-foot ceiling would take 3d6 points of damage from the " +
        "impact, then take 2d6 points of damage when it falls back to the ground. The sphere can affect a maximum of " +
        "one creature or object per round, and winks out if it exceeds the spell's range.";

    let fx_speed    =undefined;
    let fx_duration = undefined;
    let fx          =  undefined;
    let gm_command  =  '[Roll struck damage](!&#13;/w gm [[floor('+checkroll1+'&#41;&#93;&#93; struck damage (air&#41;) ' +
        '[Roll height](!&#13;/w gm [[floor('+checkroll2+'&#41;&#93;&#93; ft (fall damage: 1d6 per 10 ft&#41;) ' +
        '[Fall damage](!&#13;/w gm [[[[floor(&#63;{Height in ft}/10&#41;&#93;&#93;d6&#93;&#93; fall damage)';

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

arcane_sight = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Arcane Sight";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/arcane-sight--2476/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }

    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: undefined
        };
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Div";
    let level       = "Trapsmith 1, Sorcerer 3, Sha'ir 3, Savant 3 (Arcane), Death Master 3, Beguiler 3, " +
        "Knight of the Weave 3, Ebonmar Infiltrator 3, Hoardstealer 3, Wizard 3, Court Herald 3";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "This spell makes your eyes glow blue and allows you to **see magical auras** within **120 feet** of you.\n" +
        "The effect is similar to that of a detect magic spell, but arcane sight does not require concentration and discerns aura location and power more quickly.\n" +
        "You know the **location and power of all magical auras** within your sight.\n" +
        "If the items or creatures bearing the auras are in line of sight, you can make Spellcraft skill checks to determine the school of magic involved in each.\n" +
        "(Make one check per aura; DC 15 + spell level, or 15 + one-half caster level for a nonspell effect).\n" +
        "If you **concentrate on** a specific **creature within 120 feet** of you as a **standard action**, you can determine whether it has any spellcasting or spell-like abilities, whether these are arcane or divine (spell-like abilities register as arcane), and the strength of the most powerful spell or spell-like ability the creature currently has available for use.\n" +
        "In some cases, arcane sight may give a deceptively low reading—for example, when you use it on a spellcaster who has used up most of his or her daily spell allotment.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

dispel_magic = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Dispel Magic";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/dispel-magic--2315/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: undefined
        };
    }

    let compatible_feats = [
        'enlarge_spell', 'sudden_enlarge',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'widen_spell', 'sudden_widen'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Abj";
    let level       = "Trapsmith 1, Bard 3, Death Master 3, Sha'ir 3, Wu Jen 3, Blighter 3, Beguiler 3, " +
        "Vigilante 3, Knight of the Chalice 3, Knight of the Weave 3, Cleric 3, Paladin 3, Sorcerer 3, Wizard 3, " +
        "Hoardstealer 3, Court Herald 3, Duskblade 4, Druid 4, Urban Druid 4, Dread Necromancer 4, Magic 3";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +"ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = "Dispels Magic on One spellcaster, creature, or object; or "+20*((meta_effect.widen_spell)? 2 : 1)+"ft. radius burst";
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "**Targeted Dispel:** One object, creature, or spell is the target of the dispel magic spell. " +
        "You make a dispel check (1d20 + your caster level, maximum +10) against the spell or against each ongoing " +
        "spell currently in effect on the object or creature. The DC for this dispel check is 11 + the spell's caster " +
        "level. \n**Area Dispel:** When dispel magic is used in this way, the spell affects everything within a "+20*((meta_effect.widen_spell)? 2 : 1)+"-foot radius.\n" +
        "For each creature within the area that is the subject of one or more spells, you make a dispel check against " +
        "the spell with the highest caster level. If that check fails, you make dispel checks against progressively " +
        "weaker spells until you dispel one spell (which discharges the dispel magic spell so far as that target is " +
        "concerned) or until you fail all your checks. The creature's magic items are not affected.\n" +
        "For each object within the area that is the target of one or more spells, you make dispel checks as with " +
        "creatures. Magic items are not affected by an area dispel. \n**Counterspell:** When dispel magic is used in this " +
        "way, the spell targets a spellcaster and is cast as a counterspell. Unlike a true counterspell, " +
        "however, dispel magic may not work; you must make a dispel check to counter the other spellcaster's spell.";
    let fx          = undefined;
    let gm_command  =  '[Roll dispel check](!&#13;/w gm [[1d20+'+Math.min(caster.casterlevel, 10)+'&#93;&#93; vs. [[11+&#63;{Spellcaster level}&#93;&#93;) ' +
        '[Roll suppress magical item duration](!&#13;/w gm [[1d4&#93;&#93; rounds suppressed)';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

fireball = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Fireball";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/fireball--2612/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A tiny ball of bat guano and sulfur.',
            f: undefined
        };
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'maximize_spell', 'sudden_maximize',
        'empower_spell', 'sudden_empower',
        'enlarge_spell', 'sudden_enlarge'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);

    if(target.name === undefined){
        target.name = 'creature';
    }

    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Evocation (fire)";
    let level       = " Sor/Wiz 3, Warmage 3, Wu Jen 3 (Fire), Sha'ir 3, Shugenja 4 (Agasha School)";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'M';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Long: "+((400*((meta_effect.enlarge_spell)? 2 : 1))+40*caster.casterlevel) +" ft";
    let duration    = 'Instantaneous';
    let effect      = 'An '+20*((meta_effect.widen_spell)? 2 : 1)+' ft explosion of flame';
    let saving_throw= "Reflex (half)<br>(DC: [[@{spelldc3}+@{sf-evocation}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '[['+(Math.min(caster.casterlevel,10))*6+'+floor('+Math.min(caster.casterlevel,10)+'d6 * 0.5)]]';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '[['+(Math.min(caster.casterlevel,10))*6+']] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += '[[floor('+(Math.min(caster.casterlevel,10))+'d6 * 1.5)]] ';
    }else{  //no maximze and no empower
        checkroll += '[['+(Math.min(caster.casterlevel,10))+'d6]] ';
    }


    let notes  = "A fireball spell is an explosion of flame that detonates with a low roar and deals **"+checkroll+
        "** points of fire damage to every creature within the area. Unattended objects also take this damage. " +
        "The explosion creates almost no pressure. A glowing, pea-sized bead streaks from the pointing finger and, " +
        "unless it impacts upon a material body or solid barrier prior to attaining the prescribed range, " +
        "blossoms into the fireball at that point. (An early impact results in an early detonation). If you attempt to " +
        "send the bead through a **narrow passage**, such as through an arrow slit, you must *hit* the opening with a " +
        "**ranged touch attack**, or else the bead strikes the barrier and detonates prematurely. The fireball sets fire " +
        "to combustibles and damages objects in the area. It can melt metals with low melting points, such as " +
        "lead, gold, copper, silver, and bronze. If the damage caused to an interposing barrier shatters or " +
        "breaks through it, the fireball may continue beyond the barrier if the area permits; otherwise it stops at " +
        "the barrier just as any other spell effect does.";

    //let fx_speed    = 20;
    //let fx_duration = Math.round(calc_distance({ x : caster.token.get('left'), y : caster.token.get('top')},
    //    { x : target.token.get('left'), y : target.token.get('top')})/fx_speed);
    let fx          =  undefined;/**{
        'from_x'    : caster.token.get('left'),
        'from_y'    : caster.token.get('top'),
        'effect'    : undefined,
        'to_x'      : target.token.get('left'),
        'to_y'      : target.token.get('top'),
        'custom'    : {
            "angleRandom": -1,
            "duration": fx_duration,
            "emissionRate": 600,
            "endColour": [255, 223, 94, 1],
            "endColourRandom": [30, 20, 0, 0],
            "lifeSpan": fx_duration,
            "lifeSpanRandom": -1,
            "maxParticles": 1,
            "size": 10,
            "gravity": {x : 0.0, y: 0.0},
            "sizeRandom": -1,
            "speed": fx_speed,
            "speedRandom": -1,
            "startColour": [255, 223, 94, 1],
            "startColourRandom": [30, 20, 0, 0],
            "angle": calc_angle({ x : caster.token.get('left'), y : caster.token.get('top')},
                { x : target.token.get('left'), y : target.token.get('top')}),
        },
        'line'      : true
    };**/
    let gm_command  =  undefined;

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

fireburst = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Fireburst";
    let url         = "https://dndtools.net/spells/spell-compendium--86/fireburst--4503/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A bit of sulfur.',
            f: undefined
        };
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'maximize_spell', 'sudden_maximize',
        'empower_spell', 'sudden_empower'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);

    if(target.name === undefined){
        target.name = 'creature';
    }

    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Evo (fire)";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'M';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = 10*((meta_effect.widen_spell)? 2 : 1)+" ft";
    let duration    = 'Instantaneous';
    let effect      = 'Burst of fire extending '+range+' from you';
    let saving_throw= "Reflex (half)<br>(DC: [[@{spelldc3}+@{sf-evocation}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '[['+(Math.min(caster.casterlevel,5))*8+'+floor('+Math.min(caster.casterlevel,5)+'d8 * 0.5)]]';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '[['+(Math.min(caster.casterlevel,5))*8+']] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += '[[floor('+Math.min(caster.casterlevel,5)+'d8 * 1.5)]] ';
    }else{  //no maximze and no empower
        checkroll += '[['+Math.min(caster.casterlevel,5)+'d8]] ';
    }
    let notes  = "Fireburst causes a powerful explosion of flame to burst from you. All creatures and objects " +
        "within that area, except for you and any creatures or objects that share your space, take "+checkroll+
        " points of fire damage.";
    let fx_speed    = 20;
    let fx_duration = 25;
    let fx          =  {
        'from_x'    : caster.token.get('left'),
        'from_y'    : caster.token.get('top'),
        'effect'    : undefined,
        'to_x'      : target.token.get('left'),
        'to_y'      : target.token.get('top'),
        'custom'    : {
            "angleRandom": 360,
            "duration": fx_duration,
            "emissionRate": 200,
            "endColour": [0, 0, 0, 0],
            "endColourRandom": [0, 0, 0, 0],
            "lifeSpan": 15*((meta_effect.widen_spell)? 2 : 1),
            "lifeSpanRandom": 5,
            "maxParticles": 2000,
            "size": 20,
            "gravity": {x : 0.0, y: 0.0},
            "sizeRandom": 20,
            "speed": fx_speed,
            "speedRandom": 3,
            "startColour": [150, 90, 50, 1],
            "startColourRandom": [30, 20, 0, 0],
            "angle": 90,
        },
        'line'      : true
    };
    let gm_command  =  undefined;

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

haste = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Haste";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/haste--2823/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A shaving of licorice root.',
            f: undefined
        };
    }

    let compatible_feats = [
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Transmutation";
    let level       = "Trapsmith 1, Telflammar Shadowlord 2, Bard 3, Wizard 3, Vigilante 3, Sorcerer 3, Sha'ir 3, " +
        "Runescarred Berserker 3, Jester 3, Fatemaker 3, Beguiler 3, Wu Jen 3, Time 3, Celerity 4";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*(Math.floor(caster.casterlevel/2))) +"ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+" rounds";
    let effect      = "Casts Haste on "+caster.casterlevel+" creatures, no two of which can be more than 30 ft. apart";
    let saving_throw= "Fortitude negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The transmuted creatures move and act more quickly than normal. This extra speed has " +
        "several effects. When making a full attack action, a hasted creature may make **one extra attack** with any " +
        "weapon he is holding. The attack is made using the creature's **full base attack bonus**, plus any modifiers " +
        "appropriate to the situation. (This effect is **not cumulative with similar effects**, such as that provided by " +
        "a weapon of speed, **nor does it actually grant an extra action**, so you can't use it to cast a second spell " +
        "or otherwise take an extra action in the round). A hasted creature gains a **+1 bonus on attack rolls** and " +
        "**a +1 dodge bonus to AC and Reflex saves**. Any condition that makes you lose your Dexterity bonus to Armor " +
        "Class (if any) also makes you lose dodge bonuses. All of the hasted creature's modes of **movement** (" +
        "including land movement, burrow, climb, fly, and swim) **increase by 30 feet**, to a **maximum of twice** " +
        "the subject's normal speed using that form of movement. This increase counts as an enhancement bonus, " +
        "and it affects the creature's jumping distance as normal for increased speed. Multiple haste effects don't " +
        "stack. Haste dispels and counters slow.";
    let fx          = undefined;

    let addtnl_setattr = '--dodgebonus4bonus|1 --dodgebonus4name|Haste --dodgebonus4notes|Haste +1 AC';

    if(target.get_attr('dodgebonus4bonus') === '1'
        && target.get_attr('dodgebonus4name') === 'Haste'
        && target.get_attr('dodgebonus4notes') === 'Haste +1 AC'){
        addtnl_setattr = '';
    }

    let gm_command  =  '<br>Select tokens and use the Buttons:<br>[Set Haste](!setattr --sel --dodgebonus4inuse|1 '+addtnl_setattr+' ' +
        '&#13;!modattr --sel --mabtempmod|1 --rabtempmod|1 --reflextempmod|1)<br>' +
        '[Unset Haste](!setattr --sel --dodgebonus4inuse|0 ' +
        '&#13;!modattr --sel --mabtempmod|-1 --rabtempmod|-1 --reflextempmod|-1)';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

haste_3_0 = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Haste (3.0)";
    let url         = "https://www.dandwiki.com/wiki/3e_SRD:Haste";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A shaving of licorice root.',
            f: undefined
        };
    }

    let compatible_feats = [
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Transmutation";
    let level       = "Brd 3, Sor/Wiz 3";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*(Math.floor(caster.casterlevel/2))) +"ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+" rounds";
    let effect      = "Casts Haste on one creature.";
    let saving_throw= "Fortitude negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The transmuted creature moves and acts more quickly than normal. This extra speed has " +
        "several effects. On its turn, the subject may take **an extra partial action**, either **before or after** its " +
        "**regular action**. The subject gains a **+4** haste bonus to **AC**. The subject loses this bonus whenever it would " +
        "lose a dodge bonus. The subject can jump one and a half times as far as normal. This increase counts as an " +
        "enhancement bonus. Haste dispels and counters slow.";
    let fx          = undefined;

    let addtnl_setattr = '--dodgebonus4bonus|4 --dodgebonus4name|Haste --dodgebonus4notes|Haste +4 AC';

    if(target.get_attr('dodgebonus4bonus') === '4'
        && target.get_attr('dodgebonus4name') === 'Haste'
        && target.get_attr('dodgebonus4notes') === 'Haste +4 AC'){
        addtnl_setattr = '';
    }

    let gm_command  =  '[Set Haste](!setattr --charid '+target.character.id+' --dodgebonus4inuse|1 '+addtnl_setattr+')<br>' +
        '[Unset Haste](!setattr --charid '+target.character.id+' --dodgebonus4inuse|0)';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

low_light_vision = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Low-light Vision";
    let url         = "https://dndtools.net/spells/spell-compendium--86/low-light-vision--3781/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: undefined
        };
    }

    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Transmutation";
    let level       = "Assassin 1, Druid 1, Ranger 1, Sorcerer 1, Wizard 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+" hours";
    let effect      = "Grants low-light vision";
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "You pass your hand over the subject's eyes and murmur the arcane words. Its eyes grow " +
        "larger, and when it opens them, the pupils are speckled with tiny silvers of starlight. You give the " +
        "target creature low-light vision, the ability to **see twice as far as a human in starlight, " +
        "moonlight, torchlight, and similar conditions of poor illumination**.";
    let fx          = undefined;
    let gm_command  =  '[Set Low-light Vision](!token-mod --ignore-selected --set light_multiplier|2 --ids '+target_id+') ' +
        '<br>[Remove Low-light Vision](!token-mod --ignore-selected --set light_multiplier|1 --ids '+target_id+')';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

mage_armor = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Mage Armor";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/mage-armor--2405/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A piece of cured leather.'
        };
    }

    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Con (Creation) [force]";
    let level       = "Sorcerer 1, Wizard 1, Knight of the Weave 1, Beguiler 1, " +
        "Sha'ir 1, Court Herald 1, Force 1, Spell 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Creature touched";
    let duration    = 1*caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours';
    let effect      = "+4 AC";
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "An invisible but tangible field of force surrounds the subject of a mage armor spell, " +
        "providing a **+4 armor bonus to AC**. Unlike mundane armor, mage armor entails **no armor check penalty, " +
        "arcane spell failure chance, or speed reduction**. Since mage armor is made of force, **incorporeal creatures " +
        "can't bypass it** the way they do normal armor.";

    let fx          = undefined;

    let addtnl_setattr = '--miscac6immoblac|1 --miscac6ffac|1 --miscac6touchac|1 --miscac6stdac|1 --miscac6bonus|4 --miscac6name|Mage Armor --miscac6notes|Mage Armor +4 AC ';

    if(target.get_attr('miscac6immoblac') === '1'
        && target.get_attr('miscac6ffac') === '1'
        && target.get_attr('miscac6touchac') === '1'
        && target.get_attr('miscac6stdac') === '1'
        && target.get_attr('miscac6bonus') === '4'
        && target.get_attr('miscac6name') === 'Mage Armor'
        && target.get_attr('miscac6notes') === 'Mage Armor +4 AC'){
        addtnl_setattr = '';
    }

    let gm_command  =  '[Set Mage Armor](!setattr --charid '+target.character.id+' --miscac6inuse|1 '+addtnl_setattr+')<br>' +
                    '[Unset Mage Armor](!setattr --charid '+target.character.id+' --miscac6inuse|0)';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

magic_missile = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Magic Missile";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/magic-missile--2631/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: undefined
        };
    }

    let compatible_feats = [
        'enlarge_spell', 'sudden_enlarge',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'maximize_spell', 'sudden_maximize',
        'empower_spell', 'sudden_empower'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Evo [force]";
    let level       = " Sor/Wiz 1, Warmage 1, Knight of the Weave 1, Nentyar Hunter 1, Sha'ir 1, Wu Jen 1, Force 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = 'Instantaneous';
    let effect      = "Magic missiles";
    let saving_throw= "None";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let missiles = (Math.min(1+Math.floor((caster.casterlevel-1)/2),5));
    let checkroll = '[[1d4+1]] ';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll = '[[4+1+floor((1d4+1)*0.5)]]';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll = '[[4+1]] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll = '[[floor((1d4+1)*1.5)]] ';
    }
    let missile_rolls = '';
    for(let i = 0; i < missiles; i++){
        missile_rolls += checkroll;
    }
    let notes       = "**"+missiles+" missiles** of magical energy darts forth " +
        "from your fingertip and strikes its target, **dealing "+missile_rolls+"points of force damage**. " +
        "The missile strikes unerringly, even if the target is in melee combat or has less than total cover or " +
        "total concealment. Specific parts of a creature can't be singled out. Inanimate objects are not damaged " +
        "by the spell. If you shoot multiple missiles, you can have them strike a single creature or several creatures." +
        "A single missile can strike only one creature. You must designate targets before you check for spell resistance or roll damage.";

    let fx          = undefined;

    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

mass_darkvision = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Mass Darkvision";
    let url         = "https://dndtools.net/spells/spell-compendium--86/darkvision-mass--4340/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A dried carrot or three small agates.',
            f: undefined
        };
    }

    let compatible_feats = [
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Transmutation";
    let level       = "Sor/Wiz 4";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = (10*((meta_effect.enlarge_spell)? 2 : 1))+" ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+" hours";
    let effect      = "Grants darkvision on multiple creatures";
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The subjects gain the ability to **see 60 feet even in total darkness**. Darkvision is **black and " +
        "white** only but otherwise like normal sight. Darkvision does **not** grant one the ability to **see in " +
        "magical darkness**.";
    let fx          = undefined;

    let gm_command  =  '<br>Select tokens and use the Buttons:<br>[Set Darkvision](!token-mod --set light_otherplayers|0 light_multiplier|1 light_dimradius|-5 light_radius|60) ' +
    '<br>[Remove Darkvision](!token-mod --set light_dimradius|0 light_radius|0)';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

protection_from_arrows = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Protection from Arrows";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/protection-from-arrows--2345/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A piece of shell from a tortoise or a turtle.'
        };
    }

    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Abj";
    let level       = "Sor/Wiz 2, Wu Jen 2 (Metal), Sha'ir 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Creature touched";
    let duration    = 1*caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours';
    let effect      = undefined;
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The warded creature gains resistance to ranged weapons. The subject " +
        "gains **damage reduction 10/magic against ranged weapons**. (This spell doesn't grant you the" +
        " ability to damage creatures with similar damage reduction). **Once** the spell has **prevented** a " +
        "total of **"+Math.min(10*caster.casterlevel,100)+" points of damage, it is discharged**.";

    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

swim = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Swim";
    let url         = "https://dndtools.net/spells/spell-compendium--86/swim--4291/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A goldfish scale.',
            f: undefined
        };
    }

    let compatible_feats = [
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Transmutation (water)";
    let level       = "Sor/Wiz/Dru 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = 1*caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "This spell gives the recipient a **swim speed of 30 feet** (although not the ability " +
        "to breathe water or hold one's breath beyond normal limits). As long as the creature **isn't carrying more " +
        "than a light load, it can swim without making Swim checks**. It also gains a **+8 bonus on any Swim checks** " +
        "to perform special actions or avoid hazards, though it still takes the **normal penalty for weight carried**" +
        " (—1 per 5 pounds). The recipient **can choose to take 10 on Swim checks, even if rushed or threatened**, and" +
        " can use the **run action while swimming if it swims in a straight line**. If the creature is " +
        "carrying more than a light load, it must make Swim checks to move (taking the normal penalty for " +
        "weight carried), but all other benefits of the spell still apply.";

    let fx          = undefined;
    let gm_command  =   '<br>[Set Swim](!modattr --swimmiscmod|8 --charid '+target.character.id+')<br>' +
        '[Unset Swim](!modattr --swimmiscmod|-8 --charid '+target.character.id+')';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

wall_of_gloom = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Wall of Gloom";
    let url         = "https://dndtools.net/spells/complete-arcane--55/wall-of-gloom--518/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A bit of fleece from a black sheep.',
            f: undefined
        };
    }

    let compatible_feats = [
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend',
        'widen_spell', 'sudden_widen',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Illusion (Shadow) [Darkness, Fear, Mind-Affecting]";
    let level       = "Sor/Wiz 2, Wu Jen 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = 'Concentration, after Concentration is dropped: '+caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds';
    let effect      = 'Semiopaque **sheet** of darkness up to **'+(40*((meta_effect.widen_spell)? 2 : 1))+' ft long**,\n or a **ring** of darkness with a ' +
        'radius of up to **'+(15*((meta_effect.widen_spell)? 2 : 1))+' ft**.; either form **20 ft high**';
    let saving_throw= "Will negates; see text<br>(DC: [[@{spelldc2}+@{sf-illusion}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])\"";
    let ranged_touch= undefined;
    let notes       = "You create a barrier of ominous shadow that obscures vision and deters passage. " +
        "Creatures in **squares adjacent** to the wall have **concealment against attacks** from the other side, " +
        "while creatures **more than 1 square away** have **total concealment**. Although the wall is not substantial, " +
        "a creature with **6 or fewer Hit Dice** must succeed on a **Will save** or be halted at its edge, ending its move " +
        "action (though a creatures can move away from the wall or attempt to move through again if it has a second " +
        "move action available). A creature **can attempt** to pass the wall **any number of times**, but **each** previous " +
        "**failure** imposes a **cumulative -1 penalty on its Will save**. Wall of gloom counters or dispels any light " +
        "spell of equal or lower level.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

const spells = {
    "read_magic" : read_magic,
    "lesser_orb_fire" : lesser_orb_fire,
    "dimension_door"  : dimension_door,
    "burning_blood" : burning_blood,
    "defenestrating_sphere" : defenestrating_sphere,
    'arcane_sight'  : arcane_sight,
    'dispel_magic' : dispel_magic,
    'fireball' : fireball,
    'fireburst' : fireburst,
    'haste' : haste,
    'haste_3_0' : haste_3_0,
    'low_light_vision' : low_light_vision,
    'mage_armor'  : mage_armor,
    'magic_missile' : magic_missile,
    'mass_darkvision' : mass_darkvision,
    'protection_from_arrows' : protection_from_arrows,
    'swim'  : swim,
    'wall_of_gloom' : wall_of_gloom
};

const no_target = ['arcane_sight', 'read_magic', 'dimension_door', 'defenestrating_sphere', 'dispel_magic', 'fireball', 'fireburst',
    'haste', 'magic_missile', 'mass_darkvision', 'wall_of_gloom'];