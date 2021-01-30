//todo
/**
 * make 100% oop
 * order functions
 * help text
 * add doc to each function
 * html outputs (/direct)
 * config using state
 * add heighten feat
 * add explode feat
 * find and fix bugs
 */
const debug = false;
const disable_sudden_check = true;
const version = 'v0.8.6.pre-release';
/**
 * helpers
 */
spell_resist = {
    yes: "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])",
    no: "No"
};

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
            msg_orig.selected = [get_token(caster_id)];
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
    if(debug){
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
    else{
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
        if(debug){
            log('-=> SpellGenius [DEBUG] '+version+' <=-');
        } else {
            log('-=> SpellGenius '+version+' <=-');
        }
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
const meta_feat_selector = {
    enlarge:    ['enlarge_spell', 'sudden_enlarge'],
    empower:    ['empower_spell', 'sudden_empower'],
    extend:     ['extend_spell', 'sudden_extend'],
    maximize:    ['maximize_spell', 'sudden_maximize'],
    widen:      ['widen_spell', 'sudden_widen'],
    quicken:    ['quicken_spell', 'sudden_quicken'],
    silent:     ['silent_spell', 'sudden_silent'],
    still:      ['still_spell', 'sudden_still']
};
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
    let level       = "Sor/Wiz 0";//"Brd 0, Clr 0, Drd 0, Pal 1, Rgr 1, Sor/Wiz 0";
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
    let notes       = "You can decipher magical inscriptions that would otherwise be unintelligible, 250 words per minute, a glyph or warding.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

shield = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Shield";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/shield--2364/";
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
    let school      = "Abjuration";
    let level       = "Sor/Wiz 1";//"Brd 0, Clr 0, Drd 0, Pal 1, Rgr 1, Sor/Wiz 0";
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
    let notes       = "Shield creates an invisible, tower shield-sized mobile disk of force that hovers in front of you." +
        "It **negates magic missile attacks directed at you**." +
        "The disk also provides a **+4 shield bonus to AC** (does not stack with a normal shield).\n" +
        "This bonus applies against incorporeal touch attacks, since it is a force effect." +
        "The shield has no armor check penalty or arcane spell failure chance." +
        "Unlike with a normal tower shield, you can't use the shield spell for cover.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

mount = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Mount";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/mount--2412/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }

    let compatible_feats = [
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }
    if(info === 'mat_comp'){
        return {
            m: 'A bit of horse hair',
            f: undefined
        };
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);

    if(target.name === undefined){
        target.name = 'creature';
    }

    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Enchantment";
    let level       = "Sor/Wiz 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";
    let cast_time   = "1 round";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*(Math.floor(caster.casterlevel/2))) +"ft";
    let duration    = 2*caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours';
    let effect      = 'One Mount';
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;

    let notes  = "You summon a light horse or a pony (your choice) to serve you as a mount." +
        "The steed serves willingly and well. The mount comes with a bit and bridle and a riding saddle.";

    let fx_speed    = undefined;
    let fx_duration = undefined;
    let fx          =  undefined;
    let gm_command  =  undefined;

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

unseen_servant = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Unseen Servant";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/unseen-servant--2468/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }

    let compatible_feats = [
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }
    if(info === 'mat_comp'){
        return {
            m: 'A piece of string and a bit of wood',
            f: undefined
        };
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);

    if(target.name === undefined){
        target.name = 'creature';
    }

    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Conjuration";
    let level       = "Sor/Wiz 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";
    let cast_time   = "1 standard action";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*(Math.floor(caster.casterlevel/2))) +"ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours';
    let effect      = 'One invisible, mindless, shapeless servant';
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;

    let notes  = "**Str: 2, Speed: 15ft, hp: 6.** " +
        "An unseen servant is an invisible, mindless, shapeless force that performs simple tasks at your command. " +
        "It can run and fetch things, open unstuck doors, and hold chairs, as well as clean and mend. " +
        "The servant can perform only one activity at a time, but it repeats the same activity over and " +
        "over again if told to do so, thus allowing you to command it to clean the floor and then turn your attention " +
        "elsewhere as long as you remain within range. It can open only normal doors, drawers, lids, and the like." +
        " It has an effective Strength score of 2 (so it can lift 20 pounds or drag 100 pounds)." +
        " It can trigger traps and such, but it can exert only 20 pounds of force, which is not enough to activate" +
        " certain pressure plates and other devices. It can't perform any task that requires a skill check with a " +
        "DC higher than 10 or that requires a check using a skill that can't be used untrained. " +
        "Its speed is 15 feet. The servant cannot attack in any way; it is never allowed an attack roll. " +
        " It cannot be killed, but it dissipates if it takes 6 points of damage from area attacks. (It gets no " +
        "saves against attacks). If you attempt to send it beyond the spell's range (measured from your current " +
        "position), the servant ceases to exist.";

    let fx_speed    = undefined;
    let fx_duration = undefined;
    let fx          =  undefined;
    let gm_command  =  undefined;

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

identify = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Identify";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/identify--2502/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A pearl of at least 100 gp value, crushed and stirred into wine with an owl feather; the infusion must be drunk prior to spellcasting',
            f: undefined
        };
    }
    let compatible_feats = [
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
    let level       = "Sor/Wiz 1";//"Brd 0, Clr 0, Drd 0, Pal 1, Rgr 1, Sor/Wiz 0";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = "1 hour";
    let range       = "Touch";
    let duration    = 'Instantaneous';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "The spell determines all magic properties of a single magic item, " +
        "including how to activate those functions (if appropriate), and how many charges are left (if any)." +
        "Identify does not function when used on an artifact (see the Dungeon Master's Guide for details on artifacts).";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

mage_hand_greater = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Mage Hand, Greater";
    let url         = "https://www.dndtools.net/spells/spell-compendium--86/mage-hand-greater--4462/";
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
        'enlarge_spell', "sudden_enlarge",
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
    let level       = "Sor/Wiz 1";//"Brd 0, Clr 0, Drd 0, Pal 1, Rgr 1, Sor/Wiz 0";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = 'Concentration';
    let effect      = undefined;
    let saving_throw= "Will negates<br>(DC: [[@{spelldc1}+@{sf-transmutation}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let notes       = "A greater mage hand spell can lift an object and move it at will from a distance. " +
        "As a **move action**, you can propel the target up to **20 ft** in any direction, although the spell " +
        "ends if the distance between you and the subject ever exceeds the spell's range." +
        "A creature can negate the effect against an object it possesses with a successful Will save or " +
        "if you fail to overcome its spell resistance. An object can be telekinetically manipulated as if " +
        "with one hand. For example, a lever or rope can be pulled, a key can be turned, an object rotated, " +
        "and so on, if the force required is within the weight limitation. " +
        "The spell has an effective **Strength** of **10**.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

power_word_pain = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Power Word Pain";
    let url         = "https://dndtools.net/spells/races-of-the-dragon--83/power-word-pain--3090/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
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
    let school      = "Enchantment";
    let level       = "Sor/Wiz 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*(Math.floor(caster.casterlevel/2))) +"ft";
    let duration    = 'depends (gm has to roll)';
    let effect      = 'A word you speak causes continuing pain to your target.';
    let saving_throw= "None";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '6+(1d6&#42;0.5&#41;';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '6';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += '1d6&#42;1.5';
    }else{  //no maximze and no empower
        checkroll += '1d6';
    }

    let notes  = "You utter a single word of power that instantly deals "+checkroll+" points of damage to one creature of your " +
        "choice, and another "+checkroll+" points in every round thereafter for as long as the spell lasts. The duration of the " +
        "spell depends on the target's current hit point total, as shown below. Any creature that currently has " +
        "101 or more hit points is unaffected by power word pain.";

    let fx_speed    = undefined;
    let fx_duration = undefined;
    let fx          =  undefined;
    let gm_command  =  '[Roll damage (click each round)](!&#13;/w gm [[floor('+checkroll+'&#41;&#93;&#93; **damage**) ' +
        '&#13;[Rounds (hp &#60;51)](!&#13;/w gm [['+(4*((meta_effect.extend_spell)? 2 : 1))+'d4&#93;&#93; **rounds**)' +
        '&#13;[Rounds (hp 51-75)](!&#13;/w gm [['+(2*((meta_effect.extend_spell)? 2 : 1))+'d4&#93;&#93; **rounds**)' +
        '&#13;[Rounds (hp 76-100) ](!&#13;/w gm [['+((meta_effect.extend_spell)? 2 : 1)+'d4&#93;&#93; **rounds**)';

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

nystuls_magic_aura = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Nystul's Magic Aura";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/nystuls-magic-aura--2688/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A small square of silk that must be passed over the object that receives the aura.'
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
    let school      = "Illusion";
    let level       = "Sor/Wiz 1";//;"Cleric 1, Savant 1 (Divine), Sha'ir 1, Divine Bard 1, " +
    //"Knight of the Chalice 1, Vassal of Bahamut 1, Runescarred Berserker 1, Healer 1, " +
    //"Adept 1, Wizard 1, Sorcerer 1, Paladin 1, Demonologist 1, Good 1, Elysium 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+" Days";
    let effect      = "Alter aura of one touched object weighing up to "+5*caster.casterlevel+" lb";
    let saving_throw= "Will (see text)<br>(DC: [[@{spelldc1}+@{sf-illusion}]])";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "You alter an item's aura so that it registers to detect spells " +
        "(and spells with similar capabilities) as though it were nonmagical, or a magic item of a kind you specify, " +
        "or the subject of a spell you specify. You could make an ordinary sword register as a +2 vorpal sword as far " +
        "as magical detection is concerned or make a +2 vorpal sword register as if it were a +1 sword or even a " +
        "nonmagical sword. If the object bearing Nystul's magic aura has identify cast on it or is similarly " +
        "examined, the examiner recognizes that the aura is false and detects the object's actual qualities if he " +
        "succeeds on a Will save. Otherwise, he believes the aura and no amount of testing reveals what the true magic is." +
        "If the targeted item's own aura is exceptionally powerful (if it is an artifact, for instance), " +
        "Nystul's magic aura doesn't work. Note: A magic weapon, shield, or suit of armor must be a masterwork " +
        "item, so a sword of average make, for example, looks suspicious if it has a magical aura.";
    let fx          =  undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

sleep = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Sleep";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/sleep--2571/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A pinch of fine sand, rose petals, or a live cricket.',
            f: undefined
        };
    }
    let compatible_feats = [
        'widen_spell', 'sudden_widen',
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
    let school      = "Enchantment";
    let level       = "Sor/Wiz 1";//"Brd 0, Clr 0, Drd 0, Pal 1, Rgr 1, Sor/Wiz 0";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = 10*caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = "Casts sleep on one or more living creatures within a "+10*((meta_effect.widen_spell)? 2 : 1) +"ft. radius burst";
    let saving_throw= "Will negates<br>(DC: [[@{spelldc1}+@{sf-enchantment}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let notes       = "A sleep spell causes a magical slumber to come upon **4 Hit Dice** of creatures." +
        "Creatures with the **fewest HD** are affected **first**." +
        "Among creatures with **equal HD**, those who are **closest to the spell's point of origin are affected first**." +
        "Hit Dice that are not sufficient to affect a creature are wasted." +
        "Sleeping creatures are helpless." +
        "Slapping or wounding awakens an affected creature, but normal noise does not." +
        "Awakening a creature is a standard action (an application of the aid another action)." +
        "Sleep does not target unconscious creatures, constructs, or undead creatures.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

disguise_self = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Disguise Self";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/disguise-self--2666/";
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
    let school      = "Illusion";
    let level       = "Sor/Wiz 1";//"Brd 0, Clr 0, Drd 0, Pal 1, Rgr 1, Sor/Wiz 0";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = 10*caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = undefined;
    let saving_throw= "Will (see text)<br>(DC: [[@{spelldc1}+@{sf-illusion}]])";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "You make yourself—including clothing, armor, weapons, and equipment—look different. " +
        "You can seem 1 foot shorter or taller, thin, fat, or in between. You cannot change your body type. " +
        "Otherwise, the extent of the apparent change is up to you. " +
        "The spell does not provide the abilities or mannerisms of the chosen form, nor does it alter the " +
        "perceived tactile (touch) or audible (sound) properties of you or your equipment." +
        "If you use this spell to create a disguise, you get a +10 bonus on the Disguise check." +
        "A creature that interacts with the glamer gets a Will save to recognize it as an illusion. " +
        "For example, a creature that touched you and realized that the tactile sensation did not " +
        "match the visual one would be entitled to such a save.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

detect_secret_doors = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Detect Secret Doors";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/detect-secret-doors--2492/";
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
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'widen_spell', 'sudden_widen',
        'enlarge_spell', 'sudden_enlarge'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Div";
    let level       = "Sor/Wiz 1";//"Brd 0, Clr 0, Drd 0, Pal 1, Rgr 1, Sor/Wiz 0";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = (60*((meta_effect.enlarge_spell)? 2 : 1))+"ft.";
    let duration    = 'Concentration, up to '+(caster.casterlevel*((meta_effect.extend_spell)? 2 : 1 ))+' minutes';
    let effect      = 'Cone-shaped emanation ('+((meta_effect.widen_spell)? '2x line of sight' : 'line of sight')+')';
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "You can detect secret doors, compartments, caches, and so forth. " +
        "**Only passages**, doors, or openings that have been **specifically constructed to escape detection are detected** by this spell. " +
        "The amount of information revealed depends on how long you study a particular area or subject. " +
        "**1st Round**: Presence or absence of secret doors. " +
        "**2nd Round**:Number of secret doors and the location of each. " +
        "If an aura is outside your line of sight, then you discern its direction but not its exact location. " +
        "**Each Additional Round**: The mechanism or trigger for one particular secret portal closely examined by you. " +
        "Each round, you can turn to detect secret doors in a new area. " +
        "The spell can penetrate barriers, but **1 ft stone, 1\" metal, thin sheet lead, 3 ft wood/dirt blocks it**.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

endure_elements = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Endure Elements";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/endure-elements--2317/";
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
    let school      = "Abjuration";
    let level       = "Sor/Wiz 1";//"Cleric 1, Savant 1 (Divine), Sha'ir 1, Wu Jen 1 (All), Blighter 1, Knight of the Chalice 1, " +
    //"Vassal of Bahamut 1, Runescarred Berserker 1, Adept 1, Wizard 1, Sorcerer 1, Ranger 1, Paladin 1, Druid 1, " +
        //"Urban Druid 1, Sun 1, Ocean 1, Arborea 1, Endurance 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = 24*((meta_effect.extend_spell)? 2 : 1)+' hours';
    let effect      = undefined;
    let saving_throw= "Will negates";
    let spell_resist= "Yes";
    let ranged_touch= undefined;
    let notes       = "A creature protected by endure elements **suffers no harm from being in a hot or cold environment**. " +
        "It can exist** comfortably in conditions between -50 and 140 °F / -45 and 60 °C without having to make Fortitude saves** " +
        "(as described in the Dungeon Master's Guide). The creature's **equipment is likewise protected**. Endure elements " +
        "**doesn't provide any protection from fire or cold damage**, nor does it protect against other environmental " +
        "hazards such as smoke, lack of air, and so forth.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

vigilant_slumber = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Vigilant Slumber";
    let url         = "https://dndtools.net/spells/complete-mage--58/vigilant-slumber--806/";
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
    let school      = "Divination";
    let level       = "Sor/Wiz 1";//"Assassin 1, Bard 1, Sorcerer 1, Wizard 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = 12*((meta_effect.extend_spell)? 2 : 1)+' hours or until awakened';
    let effect      = undefined;
    let saving_throw= "No";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "Even as you prepare for sleep, you feel a strange alertness in the back of your mind. " +
        "You set a **specific condition under which you automatically wake up**. This condition might be anything " +
        "from 'If any Tiny or larger creature comes within 10 feet of me' to 'When the moon is at its zenith'. " +
        "The **condition must be something that you would normally be able to observe if you were awake**. Thus, " +
        "you can't set the spell to wake you when something happens elsewhere, or when an invisible foe " +
        "sneaks into your campsite. You awaken fully alert and ready for action.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

comprehend_languages = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Comprehend Languages";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/comprehend-languages--2482/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A pinch of soot and a few grains of salt.',
            f: undefined
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
    let level       = "Sor/Wiz 1";//"Bard 1, Urban Druid 1, Death Master 1, Savant 1 (Arcane, Divine), " +
        //"Sha'ir 1, Wu Jen 1, Beguiler 1, Vigilante 1, Knight of the Weave 1, Ebonmar Infiltrator 1, " +
        //"Adept 1, Wizard 1, Sorcerer 1, Cleric 1, Court Herald 1, Mind 1, Herald 1,";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = 10*caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "You can understand the spoken words of creatures or read otherwise incomprehensible written messages. " +
        "In either case, **you must touch the creature or the writing**. The spell enables you to **understand or read an unknown language, not " +
        "speak or write it**. Magical writing cannot be read, though the spell reveals that it is magical. This spell **can be foiled** by " +
        "certain **warding magic** (such as the **secret page** and **illusory script** spells). " +
        "It does not decipher codes or reveal messages concealed in otherwise normal text.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

protection_from_evil = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Protection from Evil";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/protection-from-evil--2348/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A little powdered silver with which you trace a 3-foot -diameter circle on the floor (or ground) around the creature to be warded.',
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
    let school      = "Abjuration [Good]";
    let level       = "Sor/Wiz 1";//;"Cleric 1, Savant 1 (Divine), Sha'ir 1, Divine Bard 1, " +
        //"Knight of the Chalice 1, Vassal of Bahamut 1, Runescarred Berserker 1, Healer 1, " +
        //"Adept 1, Wizard 1, Sorcerer 1, Paladin 1, Demonologist 1, Good 1, Elysium 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+" minutes";
    let effect      = "magical barrier around the subject at a distance of 1 foot";
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "No (see text)";
    let ranged_touch= undefined;
    let notes       = "**Wards** a creature **from attacks by evil creatures, from mental control, and from " +
        "summoned creatures**. It creates a **magical barrier** around the subject at a **distance of 1 foot**. The " +
        "barrier moves with the subject and has three major effects. <br>**1. +2 deflection AC**, **+2 resistance on saves**. Both apply against " +
        "attacks/effects by evil creatures. <br>**2.** (works **regardless of alignment**), the barrier **blocks any attempt to possess the " +
        "warded creature** or to exercise mental control " +
        "(including charm/compulsion effects that grant the caster ongoing " +
        "control). The barrier keeps out a possessing life force but does not expel one. " +
        " <br>**3.**, the spell **prevents bodily contact by " +
        "summoned creatures**. This causes their **natural weapon attacks to fail** and the creatures " +
        "to **recoil if such attacks require touching**. " +
        "The **protection** against contact by summoned creatures **ends if the warded creature makes an attack against**" +
        " or tries to force the barrier against **the blocked creature**. **Spell resistance can allow** a creature to " +
        "**overcome this protection** and touch the warded creature.";
    let fx          =  {
        'from_x'    : target.token.get('left'),
        'from_y'    : target.token.get('top'),
        'effect'    : 'burn-holy',
        'to_x'      : undefined,
        'to_y'      : undefined,
        'custom'    : undefined,
        'line'      : false
    };
    let gm_command  =  '[Set Aura](!token-mod --ignore-selected --set aura2_radius|1 aura2_square|false  --ids '+target_id+' ) ' +
        '<br>[Remove Aura](!token-mod --ignore-selected --set aura2_radius| --ids '+target_id+')';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

feather_fall = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Feather Fall";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/feather-fall--2813/";
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
        'extend_spell', 'sudden_extend',
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
    let level       = "Sor/Wiz 1";//"Bard 1, Sorcerer 1, Wizard 1, Vigilante 1, Jester 1, Savant 1 (Arcane), Sha'ir 1, Assassin 1, Court Herald 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V';

    let cast_time   = "free action";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*(Math.floor(caster.casterlevel/2))) +"ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds or until landing';
    let effect      = "Cast Feather Fall on **"+caster.casterlevel+"** Medium freefalling objects/creatures, no two of which may be >20 ft. apart";
    let saving_throw= "Will negates";
    let spell_resist= "Yes (object)";
    let ranged_touch= undefined;
    let notes       = "The affected creatures or objects **fall slowly**, though faster than feathers typically do. " +
        "Feather fall **instantly changes the rate at which the targets fall to** a mere **60 feet per round** (equivalent " +
        "to the end of a fall from a few feet), and the subjects **take no damage upon landing** while the spell is in " +
        "effect. However, when the **spell duration expires, a normal rate of falling resumes**. The spell **affects " +
        "one or more Medium or smaller creatures** (including gear and carried objects **up to each creature's " +
        "maximum load**) **or objects**, **or the equivalent in larger creatures**. You can cast this spell with an instant " +
        "utterance, quickly enough to save yourself " +
        "if you unexpectedly fall. Casting the spell is a free action, like casting a quickened spell. " +
        "**You may even cast this spell when it isn't " +
        "your turn**.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

persistent_blade = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Persistent Blade";
    let url         = "https://dndtools.net/spells/spell-compendium--86/persistent-blade--4623/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: "A silvered dagger."
        };
    }
    let compatible_feats = [
        'maximize_spell', 'sudden_maximize',
        'empower_spell', 'maximize_spell',
        'enlarge_spell', 'sudden_enlarge',
        'extend_spell', 'sudden_extend',
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
    let school      = "Evocation [Force]";
    let level       = "Sor/Wiz 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*(Math.floor(caster.casterlevel/2))) +"ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds';
    let effect      = "One dagger made of force";
    let saving_throw= "No";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '4+floor(1d4 * 0.5&#41;';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '4';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += 'floor(1d4 x 1.5&#41;';
    }else{  //no maximze and no empower
        checkroll += '1d4';
    }
    let sor = (parseInt(caster.get_attr('bab'))+Math.floor(parseInt(caster.get_attr('cha-mod'))/2));
    let wiz = (parseInt(caster.get_attr('bab'))+Math.floor(parseInt(caster.get_attr('int-mod'))/2));
    let notes       = "AB: (Sor: **+"+sor +"**),  (Wiz: **+"+wiz+"**) <br> DMG: **"+checkroll+" (19-20x2)**<br>"+
        "You bring into being a tiny blade of force which flies at a speed of 40 feet" +
        "and attacks any target within its range, starting in the round when you cast the spell. " +
        "It attacks on your turn once each round. If an **ally also attacks** the creature, " +
        "the blade moves on your turn to **flank the target**. As a force effect, it **can strike ethereal and " +
        "incorporeal creatures**. The **blade cannot be attacked**. Each round after the first, you can use a standard " +
        "action to **switch** to a new **target**; otherwise, it has same target. " +
        "If an attacked creature **has spell resistance**, the **resistance is checked the first time the blade strikes**. " +
        "If **successfully resisted**, the **spell is dispelled**. **If not**, the blade has its **normal " +
        "for the duration of the spell**.";
    let fx          = undefined;

    let gm_command  =  '[Roll damage](!&#13;/w gm [['+checkroll.replace('x', '*')+'&#93;&#93;)';


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
    let level       = "Sor/Wiz 4";//" Trapsmith 2, Telflammar Shadowlord 3, Bard 4, Savant 4 (Arcane), " +
        //"Jester 4, Death Master 4, Sha'ir 4, Wu Jen 4 (Earth), Duskblade 4, Court Herald 4, " +
        //"Slayer of Domiel 4, Ebonmar Infiltrator 4, Hoardstealer 4, Wizard 4, Sorcerer 4, " +
        //"Runescarred Berserker 5, Knight of the Weave 5, Travel 4, Portal (Alternative) 4, Portal 4";
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


    let notes  = "A sphere of whirling air flies to attack your enemies and hurl them to " +
        "the sky. As a move action, you can make the sphere **travel up to 30 feet per round** and strike the creature or " +
        "object you indicate as a **ranged touch attack**. Any creature **struck** by the sphere takes **"+checkroll1+"** points of damage. " +
        "In addition, **Medium or smaller** creatures must succeed on a **Fortitude save** or " +
        "be knocked prone. Creatures that fall prone must succeed on a **second Fortitude save** or be swept up  " +
        "**"+checkroll2+"** feet into the air, dropping **1d6 squares** from their original position in a **random** " +
        "direction and taking falling damage as normal. If some **obstacle** prevents the target creature from reaching " +
        "its expelled height, it takes **1d6** points of damage for every **10 feet** of movement it was unable to complete(" +
        "a creature hurled 50 ft up in a room with a 20 ft ceiling takes 3d6 damage from the " +
        "impact and 2d6 points of damage when it falls back to the ground. The sphere can affect " +
        "one creature or object per round, and winks out if it exceeds the spell's range.";

    let fx_speed    =undefined;
    let fx_duration = undefined;
    let fx          =  undefined;
    let gm_command  =  '[Roll ranged touch check](!&#13;/w gm [[1d20 + '+caster.get_attr('bab')+'+'+caster.get_attr('dex-mod')+'&#93;&#93;) ' +
        '[Roll struck damage](!&#13;/w gm [[floor('+checkroll1+'&#41;&#93;&#93; struck damage (air&#41;) ' +
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
    let level       = "Sor/Wiz 3";//"Trapsmith 1, Sorcerer 3, Sha'ir 3, Savant 3 (Arcane), Death Master 3, Beguiler 3, " +
        //"Knight of the Weave 3, Ebonmar Infiltrator 3, Hoardstealer 3, Wizard 3, Court Herald 3";
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
    let notes       = "This spell makes your eyes glow blue and allows you to **see magical auras** within **120 feet** of you." +
        "The effect is similar to that of a detect magic spell, but arcane sight does not require concentration and discerns aura location and power more quickly." +
        "You know the **location and power of all magical auras** within your sight." +
        "If the auras are in line of sight, you can make Spellcraft skill checks to determine the school of magic involved in each." +
        "(one check per aura; DC 15 + spell level, or 15 + one-half caster level for nonspell effects)." +
        "If you **concentrate on** a specific **creature within 120 feet** of you as a **standard action**, you can determine whether it has any spellcasting " +
        "or spell-like abilities, whether these are arcane or divine, the strength of the most powerful the creature currently has available for use." +
        "It may give a deceptively low reading. For example, when you use it on a spellcaster who has used up most of his or her daily spell allotment.";
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
    let level       = "Sor/Wiz 3";//"Trapsmith 1, Bard 3, Death Master 3, Sha'ir 3, Wu Jen 3, Blighter 3, Beguiler 3, " +
        //"Vigilante 3, Knight of the Chalice 3, Knight of the Weave 3, Cleric 3, Paladin 3, Sorcerer 3, Wizard 3, " +
        //"Hoardstealer 3, Court Herald 3, Duskblade 4, Druid 4, Urban Druid 4, Dread Necromancer 4, Magic 3";
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
    let notes       = "**Targeted Dispel:** One object, creature, or spell is the target of the spell. " +
        "Dispel check (1d20 + your caster level) against the spell or against each ongoing " +
        "spell currently in effect on the target. The DC is 11 + the spell's caster " +
        "level. <br>**Area Dispel:** When used this way, the spell affects everything within a "+20*((meta_effect.widen_spell)? 2 : 1)+" ft radius." +
        "For each creature within, that is the subject of one or more spells, you make a dispel check against " +
        "the spell with the highest caster level. If that check fails, you make checks against progressively " +
        "weaker spells until you dispel one spell or until you fail all your checks." +
        "For each object in the area that is the target of one or more spells, you make checks as with " +
        "creatures. Magic items are not affected by an area dispel. <br>**Counterspell:** When used in this " +
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
    let level       = "Sor/Wiz 3";//"Sor/Wiz 3, Warmage 3, Wu Jen 3 (Fire), Sha'ir 3, Shugenja 4 (Agasha School)";
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


    let notes  = "A fireball is an explosion of flame that deals **"+checkroll+
        "** points of fire damage to every creature within the area. Unattended objects also take this damage. " +
        "The explosion creates almost no pressure. A glowing, pea-sized bead streaks from the pointing finger and, " +
        "unless it impacts upon a material body or solid barrier prior to attaining the prescribed range, " +
        "blossoms into the fireball at that point. (An early impact results in an early detonation). If you attempt to " +
        "send the bead through a **narrow passage**, such as through an arrow slit, you must *hit* the opening with a " +
        "**ranged touch attack**.";

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
    let level       = "Sor/Wiz 3"; //"Trapsmith 1, Telflammar Shadowlord 2, Bard 3, Wizard 3, Vigilante 3, Sorcerer 3, Sha'ir 3, " +
        //"Runescarred Berserker 3, Jester 3, Fatemaker 3, Beguiler 3, Wu Jen 3, Time 3, Celerity 4";
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
    let notes       = "When making a full attack action, a hasted creature may make **one extra attack** with any " +
        "weapon he is holding. The attack is made using the creature's **full base attack bonus**, plus any modifiers " +
        "appropriate to the situation. (This effect is **not cumulative with similar effects**, such as that provided by " +
        "a weapon of speed, **nor does it actually grant an extra action**, so you can't use it to cast a second spell " +
        "or otherwise take an extra action in the round). A hasted creature gains a **+1 bonus on attack rolls** and " +
        "**a +1 dodge bonus to AC and Reflex saves**. Any condition that makes you lose your Dexterity bonus to Armor " +
        "Class (if any) also makes you lose dodge bonuses. All of the hasted creature's modes of **movement** (" +
        "including land movement, burrow, climb, fly, and swim) **increase by 30 feet**, to a **maximum of twice** " +
        "the subject's normal speed using that form of movement. This increase counts as an enhancement bonus, " +
        "and it affects the creature's jumping distance as normal for increased speed.";
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
    let level       = "Sor/Wiz 3";//"Brd 3, Sor/Wiz 3";
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
    let level       = "Sor/Wiz 1";//"Assassin 1, Druid 1, Ranger 1, Sorcerer 1, Wizard 1";
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
    let level       = "Sor/Wiz 1";//"Sorcerer 1, Wizard 1, Knight of the Weave 1, Beguiler 1, " +
        //"Sha'ir 1, Court Herald 1, Force 1, Spell 1";
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

    let addtnl_setattr = '--armorbonus4name|Mage Armor --armorbonus4notes|Mage Armor +4 AC ';
    let addtnl_setattr2 = '--armorbonus4bonus|4 ';
    let current_ac = parseInt(target.get_attr('acitembonus'));
    let armor_worn = target.get_attr('armorworn');

    if(target.get_attr('armorbonus4bonus') === '4'
        && target.get_attr('armorbonus4name') === 'Mage Armor'
        && target.get_attr('armorbonus4notes') === 'Mage Armor +4 AC'){
        addtnl_setattr = '';
    }

    if(armor_worn > 0){
        let ac = 4 - current_ac;
        if(ac > 0){
            addtnl_setattr2 = '--armorbonus4bonus|'+ac;
        }
        else{
            addtnl_setattr2 = '--armorbonus4bonus|0 ';
        }

    }

    let gm_command  =  '[Set Mage Armor](!setattr --charid '+target.character.id+' --armorbonus4inuse|1 '+addtnl_setattr+addtnl_setattr2+')<br>' +
                    '[Unset Mage Armor](!setattr --charid '+target.character.id+' --armorbonus4inuse|0 )';

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
    let level       = "Sor/Wiz 1";//" Sor/Wiz 1, Warmage 1, Knight of the Weave 1, Nentyar Hunter 1, Sha'ir 1, Wu Jen 1, Force 2";
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
    let level       = "Sor/Wiz 2";// "Sor/Wiz 2, Wu Jen 2 (Metal), Sha'ir 2";
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
    let level       = "Sor/Wiz 2";
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

detect_thoughts = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Detect Thoughts";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/detect-thoughts--2494/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A copper piece'
        };
    }

    let compatible_feats = [
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
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Divination";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = 'Concentration, up to '+caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = 'You detect surface thoughts in up to '+((60*((meta_effect.widen_spell)? 2 : 1))+10*caster.casterlevel) +' ft';
    let saving_throw= "Will negates; see text<br>(DC: [[@{spelldc2}+@{sf-divination}]])";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "The amount of information revealed depends on how long you study a particular area or subject." +
        "**1st Round**: Presence or absence of thoughts (from conscious creatures with Intelligence scores of 1 or higher)." +
        "**2nd Round**:Number of thinking minds and the Intelligence score of each." +
        "If the **highest Intelligence is 26 or higher** (and **at least 10 points higher than your own** Intelligence score), you are **stunned for 1 round and the spell ends**." +
        "This spell does not let you determine the location of the thinking minds if you can't see the creatures whose thoughts you are detecting." +
        "**3rd Round**: Surface thoughts of any mind in the area." +
        "A target's **Will save prevents you from reading** its thoughts, and you must cast detect thoughts again to have another chance." +
        "Creatures of animal intelligence (Int 1 or 2) have simple, instinctual thoughts that you can pick up." +
        "Each round, you can turn to detect thoughts in a new area." +
        "The spell can penetrate barriers, but 1 ft stone, 1\" metal, thin sheet lead, 3 ft wood/dirt blocks it.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

locate_object = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Locate Object";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/locate-object--2506/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A forked twig'
        };
    }

    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'enlarge_spell', 'sudden_enlarge',
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
    let school      = "Divination";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Long: "+((400*((meta_effect.enlarge_spell)? 2 : 1))+40*caster.casterlevel) +" ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = 'Circle, centered on you, with a radius of '+((400*((meta_effect.enlarge_spell)? 2 : 1))+40*caster.casterlevel) +" ft";
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "You sense the direction of a well-known or clearly visualized object." +
        "The spell locates such objects as apparel, jewelry, furniture, tools, weapons, or even a ladder." +
        "You can search for general items such as a stairway, a sword, or a jewel, in which case you locate the nearest one of its kind if more than one is within range." +
        "Attempting to find a certain item, such as a particular piece of jewelry, requires a specific and accurate mental image; if the image is not close enough to the actual object, the spell fails." +
        "You cannot specify a unique item (such as \"Baron Vulden's signet ring\") unless you have observed that particular item firsthand (not through divination)." +
        "The spell is blocked by even a thin sheet of lead." +
        "Creatures cannot be found by this spell. Polymorph any object fools it.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

see_invisibility = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "See Invisibility";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/see-invisibility--2514/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A pinch of talc and a small sprinkling of powdered silver',
            f: undefined
        };
    }

    let compatible_feats = [
        'extend_spell', 'sudden_extend',
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
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Divination";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 20 : 10)+' minutes';
    let effect      = 'Circle, centered on you, with a radius of '+((400*((meta_effect.widen_spell)? 2 : 1))+40*caster.casterlevel) +" ft";
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "You can see any objects or beings that are invisible within your range of vision, as well as any " +
        "that are ethereal, as if they were normally visible. Such creatures are visible to you as translucent shapes, " +
        "allowing you easily to discern the difference between visible, invisible, and ethereal creatures. The spell does " +
        "not reveal the method used to obtain invisibility. It does not reveal illusions or enable you to see through opaque " +
        "objects. It does not reveal creatures who are simply hiding, concealed, or otherwise hard to see. See invisibility can " +
        "be made permanent with a permanency spell.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

darkvision = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Darkvision";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/darkvision--2799/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'Either a pinch of dried carrot or an agate',
            f: undefined
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
    let school      = "Divination";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours';
    let effect      = undefined;
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The subject gains the ability to see 60 feet even in total darkness. Darkvision is " +
        "black and white only but otherwise like normal sight. Darkvision does not grant one the ability to " +
        "see in magical darkness. Darkvision can be made permanent with a permanency spell.";

    let fx          = undefined;
    let gm_command  =   '[Set Darkvision](!token-mod --ignore-selected --ids '+target_id+' --set light_otherplayers|0 light_multiplier|1 light_dimradius|-5 light_radius|60) ' +
        '<br>[Remove Darkvision](!token-mod --ignore-selected --ids '+target_id+' --set light_dimradius|0 light_radius|0)';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

bears_endurance = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Bear's Endurance";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/bears-endurance--2783/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: "devine Focus"
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
    let school      = "Transmutation";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = undefined;
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The affected creature gains greater vitality and stamina. The spell grants the subject a" +
        " +4 enhancement bonus to Constitution, which adds the usual benefits to hit points, Fortitude saves, " +
        "Constitution checks, and so forth." +
        "Hit points gained by a temporary increase in Constitution score are not temporary hit points. " +
        "They go away when the subject's Constitution drops back to normal. They are not lost first as temporary hit points are";

    let fx          = undefined;
    let additional_hp = target.get_attr('level')*2;
    let gm_command  =  '[Set Bear\'s Endurance](!modattr --charid '+target.character.id+' --con-temp|4 --hitpoints|'+target.get_attr('level')*2+' --hitpoints|'+additional_hp+'|'+additional_hp+' )<br>' +
        '[Unset Bear\'s Endurance](!modattr --charid '+target.character.id+' --con-temp|-4 --hitpoints|-'+target.get_attr('level')*2+' --hitpoints|-'+additional_hp+'|-'+additional_hp+' )';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

darkness = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Darkness";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/darkness--2600/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: "A bit of bat fur and either a drop of pitch or a piece of coal",
            f: undefined
        };
    }

    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'widen_spell', 'sudden_widen'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Transmutation";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 20 : 10)+' minutes';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "This spell causes an object to radiate shadowy illumination out to a **"+((meta_effect.widen_spell)? 40 : 20)+"ft** radius. All " +
        "creatures in the area gain concealment (**20% miss chance**). Even creatures that can normally see in such " +
        "conditions (such as with darkvision or lowlight vision) have the miss chance in an area shrouded in magical darkness. " +
        "Normal lights (torches, candles, lanterns, and so forth) are incapable of brightening the area, as are light " +
        "spells of lower level (such as light or dancing lights). Higher level light spells (such as daylight) are not " +
        "affected by darkness. If darkness is cast on a small object that is then placed inside or under a lightproof " +
        "covering, the spell's effect is blocked until the covering is removed. Darkness counters or dispels any " +
        "light spell of equal or lower spell level.";

    let fx          = undefined;
    let gm_command  =  undefined;

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

resist_energy = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Resist Energy";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/resist-energy--2357/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: "divine focus"
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
    let school      = "Abjuration";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 20 : 10)+' minutes';
    let effect      = undefined;
    let saving_throw= "Fortitude negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let dmg_protection = 10;
    if(caster.casterlevel >= 7) {
        dmg_protection = 20;
    }
    if(caster.casterlevel >= 11) {
        dmg_protection = 30;
    }

    let notes       = "This abjuration grants a creature limited protection from damage of whichever one of five " +
        "energy types you select: **acid, cold, electricity, fire, or sonic**. The subject **gains energy resistance " +dmg_protection+
        " against the energy type chosen**, meaning that each time the creature is subjected to such damage " +
        "(whether from a natural or magical source), that **damage is reduced by "+dmg_protection+" points** before being " +
        "applied to the creature's hit points. The spell protects the recipient's equipment as well. Resist energy absorbs only damage. " +
        "The subject could still suffer unfortunate side effects, such as drowning in acid (since drowning damage comes " +
        "from lack of oxygen) or becoming encased in ice." +
        "Note: Resist energy overlaps (and does not stack with) protection from energy. If a character is warded by " +
        "protection from energy and resist energy, the protection spell absorbs damage until its power is exhausted.";

    let fx          = undefined;
    let gm_command  =  undefined;

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

spectral_hand = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Spectral Hand";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/spectral-hand--2761/";
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
        'enlarge_spell', 'sudden_enlarge',
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'empower_spell' , 'sudden_empower',
        'maximize_spell', 'sudden_maximize'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Necromancy";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';


    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '[[4+floor(1d4 * 0.5)]]';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '[[4]] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += '[[floor(1d4 * 1.5)]] ';
    }else{  //no maximze and no empower
        checkroll += '[[1d4]] ';
    }
    let notes       = "A ghostly, glowing hand shaped from your life force materializes and moves as you desire, " +
        "allowing you to deliver low-level, touch range spells at a distance. On casting the spell, you lose **"+checkroll+
        " hit points** that return when the spell ends" +
        " (even if it is dispelled), **but not if the hand is destroyed**. (The hit points can be healed as normal)." +
        "For as long as the spell lasts, **any touch range spell of 4th level or lower** that you cast **can be delivered by the spectral hand**." +
        "The spell gives you a **+2 bonus on your melee touch attack roll**, and attacking with the hand counts normally as an attack." +
        "The hand always strikes from your direction. **The hand cannot flank targets** like a creature can." +
        "**After it delivers a spell**, or if the hand goes beyond the spell range, goes out of your sight, the hand returns to you and hovers." +
        "The **hand is incorporeal** and thus **cannot be harmed by normal weapons**. It has **improved evasion**" +
        " (half damage on a failed Reflex save and no damage on a successful save), **your save bonuses**, and an **AC of "+(22+caster.get_attr('int-mod'))+"**." +
        "Your **Intelligence modifier** applies to the **hand's AC** as if it were the hand's Dexterity modifier." +
        "The hand has **hit points**, the **same number that you lost in creating it**.";

    let fx          = undefined;
    let gm_command  =  undefined;

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

cats_grace = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Cat's Grace";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/cats-grace--2790/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A pinch of cat fur',
            f: undefined
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
    let school      = "Transmutation";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = undefined;
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The transmuted creature becomes more graceful, agile, and coordinated. " +
        "The spell grants a +4 enhancement bonus to Dexterity, adding the usual benefits to AC," +
        " Reflex saves, and other uses of the Dexterity modifier.";

    let fx          = undefined;
    let gm_command  =  '[Set Cat\'s Grace](!modattr --charid '+target.character.id+' --dex-temp|4 )<br>' +
        '[Unset Cat\'s Grace](!modattr --charid '+target.character.id+' --dex-temp|-4 )';


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

rope_trick = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Rope Trick";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/rope-trick--2866/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'Powdered corn extract and a twisted loop of parchment.',
            f: undefined
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
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Transmutation";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let notes       = "When this spell is cast upon a piece of rope from 5 to 30 feet long, one end of the rope rises " +
        "into the air until the whole rope hangs perpendicular to the ground, as if affixed at the upper end. The upper " +
        "end is, in fact, fastened to an extradimensional space that is outside the multiverse of extradimensional spaces " +
        "(planes). Creatures in the extradimensional space are hidden, beyond the reach of spells (including divinations), " +
        "unless those spells work across planes. The space holds as many as eight creatures (of any size)." +
        "Creatures in the space can pull the rope up into the space, making the rope \"disappear\"." +
        "In that case, the rope counts as one of the eight creatures that can fit in the space." +
        "The rope can support up to 16,000 pounds." +
        "A weight greater than that can pull the rope free." +
        "Spells cannot be cast across the extradimensional interface, nor can area effects cross it." +
        "Those in the extradimensional space can see out of it as if a 3-foot-by-5-foot window were centered on the rope." +
        "The window is present on the Material Plane, but it's invisible, and even creatures that can see the window can't see through it." +
        "Anything inside the extradimensional space drops out when the spell ends." +
        "The rope can be climbed by only one person at a time." +
        "The rope trick spell enables climbers to reach a normal place if they do not climb all the way to the extradimensional space." +
        "Note: It is hazardous to create an extradimensional space within an existing extradimensional space or to take an extradimensional space into an existing one.";

    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

knock = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Knock";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/knock--2829/";
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
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V';


    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = "Instantaneous";
    let effect      = "One door, box, or chest with an area of up to "+10*caster.casterlevel+"sq. ft.";
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;

    let notes       = "The knock spell opens stuck, barred, locked, held, or arcane locked doors. It opens secret doors," +
        " as well as locked or trick-opening boxes or chests. It also loosens welds, shackles, or chains " +
        "(provided they serve to hold closures shut). If used to open a arcane locked door, the spell does not remove " +
        "the arcane lock but simply suspends its functioning for 10 minutes. In all other cases, the door does not " +
        "relock itself or become stuck again on its own. Knock does not raise barred gates or similar impediments " +
        "(such as a portcullis), nor does it affect ropes, vines, and the like. The effect is limited by the area. " +
        "Each spell can undo as many as two means of preventing egress. Thus if a door is locked, barred, and held, " +
        "or quadruple locked, opening it requires two knock spells.";

    let fx          = undefined;
    let gm_command  =  undefined;

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

web = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Web";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/web--2472/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A bit of spider web',
            f: undefined
        };
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'widen_spell', 'sudden_widen',
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
    let school      = "Conjuration";
    let level       = "Sor/Wiz 2";//"Sor/Wiz 3, Warmage 3, Wu Jen 3 (Fire), Sha'ir 3, Shugenja 4 (Agasha School)";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'M';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = (((meta_effect.extend_spell)? 20 : 10)*caster.casterlevel)+" minutes";
    let effect      = 'Webs in a '+((meta_effect.widen_spell)? 40 : 20)+'ft. radius spread';
    let saving_throw= "Reflex (negates)<br>(DC: [[@{spelldc2}+@{sf-conjuration}]])";
    let spell_resist= "No";
    let ranged_touch= undefined;

    let notes  = "Web creates a many-layered mass of strong, sticky strands. These strands trap those caught in them. " +
        "The strands are similar to spider webs but far larger and tougher. These masses must be anchored to two or more " +
        "solid and diametrically opposed points—floor and ceiling, opposite walls, or the like—or else the web collapses " +
        "upon itself and disappears. Creatures caught within a web become entangled. **Anyone in the effect's area when the spell is cast must " +
        "make a Reflex save**. If this save **succeeds**, the **creature is entangled, but not prevented from moving**, " +
        "though moving is more difficult (see below). If the save **fails, the creature is " +
        "entangled and can't move** from its space, but can **break loose by spending 1 round and making a DC 20 Strength " +
        "check or a DC 25 Escape Artist check**. **Once loose, a creature remains entangled, but may move through the web very slowly**. " +
        "**Each round devoted to moving** allows the creature to make a **new Strength check or Escape Artist check**. " +
        "The creature moves **5 feet for each full 5 points by which the check result exceeds 10**. If you have **at least " +
        "5 feet of web between you and an opponent, it provides cover**. If you have **at least 20 feet** of web between you, " +
        "it provides **total cover** (see Cover, page 150). **The strands of a web spell are flammable**. " +
        "A magic flaming sword can slash them away as easily as a hand brushes away cobwebs. Any fire can set the webs " +
        "alight and **burn away 5 square feet in 1 round**. " +
        "**All creatures within flaming webs take 2d4 points of fire damage** from the flames.";

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

invisibility = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Invisibility";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/invisibility--2676/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'An eyelash encased in a bit of gum arabic',
            f: undefined
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
    let school      = "Illusion";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = 'Target weighting no more than '+(100*caster.casterlevel)+' lb becomes invisible';
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The creature or object touched becomes invisible, vanishing from sight, even from darkvision. " +
        "If the recipient is a creature carrying gear, that vanishes, too. If you cast the spell on someone else, " +
        "neither you nor your allies can see the subject, unless you can normally see invisible things or you employ " +
        "magic to do so. **Items dropped or put down by an invisible creature become visible; items picked up disappear " +
        "if tucked into the clothing or pouches worn by the creature**. **Light**, however, **never becomes invisible, " +
        "although a source of light can become so** (thus, the effect is that of a light with no visible source). " +
        "**Any part of an item that the subject carries but that extends more than 10 feet from it becomes visible**, " +
        "such as a trailing rope. Of course, the subject is not magically silenced, and certain other conditions can " +
        "render the recipient detectable (such as stepping in a puddle). **The spell ends if the subject attacks any " +
        "creature**. For purposes of this spell, **an attack includes any spell targeting a foe o whose area or effect " +
        "includes a foe**. **Causing harm indirectly is not an attack**. **Spells** such as bless **that specifically affect " +
        "allies but not foes are not attacks** for this purpose, even when they include foes in their area. " +
        "Invisibility can be made permanent (on objects only) with a permanency spell.";

    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

lightning_bolt = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Lightning Bolt";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/lightning-bolt--2630/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A bit of fur and an amber, crystal, or glass rod',
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
    let school      = "Evocation (electricity)";
    let level       = "Sor/Wiz 3";//"Sor/Wiz 3, Warmage 3, Wu Jen 3 (Fire), Sha'ir 3, Shugenja 4 (Agasha School)";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'M';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = ((meta_effect.enlarge_spell)? 240 : 120) +" ft line";
    let duration    = 'Instantaneous';
    let effect      = undefined;
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


    let notes  = "You release a powerful stroke of electrical energy that deals "+checkroll+" points of electricity damage" +
        " to each creature within its area. The bolt begins at your fingertips." +
        "The lightning bolt sets fire to combustibles and damages objects in its path." +
        "It can melt metals with a low melting point, such as lead, gold, copper, silver, or bronze." +
        "If the damage caused to an interposing barrier shatters or breaks through it, the bolt may continue " +
        "beyond the barrier if the spell's range permits; otherwise, it stops at the barrier just as any other spell effect does.";

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

shatterfloor = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Shatterfloor";
    let url         = "https://dndtools.net/spells/spell-compendium--86/shatterfloor--4157/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A miniature hammer and bell worth at least 10 gp.'
        };
    }

    let compatible_feats = [
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'maximize_spell', 'sudden_maximize',
        'empower_spell', 'sudden_empower',
        'enlarge_spell', 'sudden_enlarge',
        'widen_spell', 'sudden_widen'
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
    let school      = "Evocation (sonic)";
    let level       = "Sor/Wiz 3";//"Sor/Wiz 3, Warmage 3, Wu Jen 3 (Fire), Sha'ir 3, Shugenja 4 (Agasha School)";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'F';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = (((meta_effect.enlarge_spell)? 200 : 100) + 10*caster.casterlevel) +" ft";
    let duration    = 'Instantaneous';
    let effect      = 'Sonic wave with '+ ((meta_effect.widen_spell)? 30 : 15) +' ft radius';
    let saving_throw= "Reflex (half)<br>(DC: [[@{spelldc3}+@{sf-evocation}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '[['+(Math.min(caster.casterlevel,10))*4+'+floor('+Math.min(caster.casterlevel,10)+'d4 * 0.5)]]';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '[['+(Math.min(caster.casterlevel,10))*4+']] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += '[[floor('+(Math.min(caster.casterlevel,10))+'d4 * 1.5)]] ';
    }else{  //no maximze and no empower
        checkroll += '[['+(Math.min(caster.casterlevel,10))+'d4]] ';
    }


    let notes  = "You strike the bell with the hammer and evoke a loud thrumming vibration. It quickly builds to a " +
        "painful crescendo, then fades. In its wake it leaves a circle of crushed stone and rubble." +
        "Creatures and objects in the area take " + checkroll + " points of sonic damage, and can make a saving throw to " +
        "take half damage. If the floor of the area is made of stone, wood, ice, or material with hardness less than " +
        "those, the floor is pulverized, resulting in an area of difficult terrain composed of soft dust, wood " +
        "fragments, or loose crushed ice, as appropriate.";

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

fly = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Fly";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/fly--2816/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A wing feather from any bird'
        };
    }
    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'quicken_spell', 'sudden_quicken'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Transmutation";
    let level       = "Sor/Wiz 3";//"Bard 1, Sorcerer 1, Wizard 1, Vigilante 1, Jester 1, Savant 1 (Arcane), Sha'ir 1, Assassin 1, Court Herald 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'F';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = "Cast Fly on one touched object of up to "+(caster.casterlevel)+" cu. ft.";
    let saving_throw= "Will negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       = "The subject can **fly at a speed of 60 feet** (or **40 feet** if it wears medium or " +
        "heavy armor, or if it carries a medium or heavy load). It can **ascend at half speed and descend at double " +
        "speed**, and its maneuverability is good. Using a fly spell **requires only as much concentration as walking**, " +
        "so the subject **can attack or cast spells normally**. The subject of a fly spell can **charge but not run**, " +
        "and it cannot carry aloft more weight than its maximum load, plus any armor it wears. Should the spell " +
        "duration expire while the subject is still aloft, **the magic fails slowly**. The subject **floats downward " +
        "60 feet per round for 1d6 rounds.** If it reaches the ground in that amount of time, it **lands safely**. " +
        "**If not**, it falls the rest of the distance, **taking 1d6 points of damage per 10 feet of fall**. " +
        "**Since dispelling a spell effectively ends it, the subject also descends in this way if the fly spell is " +
        "dispelled**, but not if it is negated by an antimagic field.";
    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

shrink_item = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Shrink Item";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/shrink-item--2872/";
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
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
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
    let school      = "Transmutation";
    let level       = "Sor/Wiz 3";//"Sor/Wiz 3, Warmage 3, Wu Jen 3 (Fire), Sha'ir 3, Shugenja 4 (Agasha School)";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Touch";
    let duration    = (((meta_effect.extend_spell)? 2 : 1)*caster.casterlevel)+" days";
    let effect      = undefined;
    let saving_throw= "Will (negates, object)<br>(DC: [[@{spelldc3}+@{sf-transmutation}]])";
    let spell_resist= "Yes (object)<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;

    let notes  = "You are able to shrink one nonmagical item (up to "+(2*caster.casterlevel)+" cu. ft.) to 1/16 " +
        "of its normal size in each dimension (to about 1/4,000 the original volume and mass). This change effectively " +
        "reduces the object's size by four categories (for instance, from Large to Diminutive). Optionally, " +
        "you can also change its now-shrunken composition to a clothlike one. Objects changed by a shrink item spell " +
        "can be returned to normal composition and size merely by tossing them onto any solid surface or by a word of " +
        "command from the original caster. Even a burning fire and its fuel can be shrunk by this spell. Restoring " +
        "the shrunken object to its normal size and composition ends the spell. Shrink item can be made permanent " +
        "with a permanency spell, in which case the affected object can be shrunk and expanded an indefinite number " +
        "of times, but only by the original caster.";

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

protection_from_energy = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Protection from Energy";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/protection-from-energy--2347/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'divine focus'
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
    let level       = "Sor/Wiz 3";// "Sor/Wiz 2, Wu Jen 2 (Metal), Sha'ir 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Creature touched";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 20 : 10)+' minutes';
    let effect      = undefined;
    let saving_throw= "Fortitude negates (harmless)";
    let spell_resist= "Yes (harmless)";
    let ranged_touch= undefined;
    let notes       ="Protection from energy grants temporary immunity to the type of energy you specify when you " +
        "cast it (**acid, cold, electricity, fire, or sonic**). When the spell **absorbs "+Math.min(12*caster.casterlevel,120)+" damage**, it is discharged." +
        "Note: Protection from energy overlaps (and does not stack with) resist energy. If a character is warded " +
        "by protection from energy and resist energy, the protection spell absorbs damage until its power is exhausted.";


    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

vampiric_touch = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Vampiric Touch";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/vampiric-touch--2768/";
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
        'empower_spell', 'sudden_empower',
        'maximize_spell', 'sudden_maximize',
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
    let level       = "Sor/Wiz 3";// "Sor/Wiz 2, Wu Jen 2 (Metal), Sha'ir 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Creature touched";
    let duration    = 'Instantaneous';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "Yes <br> (DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let checkroll   = '';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll += '[['+(Math.min(Math.floor(caster.casterlevel/2),10))*6+'+floor('+Math.min(Math.floor(caster.casterlevel/2),10)+'d6 * 0.5)]]';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll += '[['+(Math.min(Math.floor(caster.casterlevel/2),10))*6+']] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll += '[[floor('+(Math.min(Math.floor(caster.casterlevel/2),10))+'d6 * 1.5)]] ';
    }else{  //no maximze and no empower
        checkroll += '[['+(Math.min(Math.floor(caster.casterlevel/2),10))+'d6]] ';
    }
    let notes       ="You must succeed on a melee touch attack." +
        "Your touch deals "+checkroll+" points of damage." +
        "You gain temporary hit points equal to the damage you deal." +
        "However, you can't gain more than the subject's current hit points +10, which is enough to kill the subject." +
        "The temporary hit points disappear "+((meta_effect.extend_spell)? '2 hours' : '1 hour')+" later.";


    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

polymorph = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Polymorph";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/polymorph--2854/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'An empty cocoon',
            f: undefined
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
    let school      = "Transmutation";
    let level       = "Sor/Wiz 4";// "Sor/Wiz 2, Wu Jen 2 (Metal), Sha'ir 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += 'M';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Willing living creature touched";
    let duration    = (((meta_effect.extend_spell)? 2 : 1) * caster.casterlevel) +" minutes";
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let hd = Math.min(15, caster.casterlevel);
    let notes       ="**HD: "+ hd + "**<br>" +
        "You change the willing subject into another form of living creature. The new form may be of the same type as the subject or any of the following types: **aberration, animal, dragon, fey, giant, humanoid, magical beast, monstrous humanoid, ooze, plant, or vermin**.  You can't cause a subject to assume a form smaller than Fine, nor can you cause a subject to assume an incorporeal or gaseous form. The subject's creature type and subtype (if any) change to match the new form (see the Monster Manual for more information). " +
        "Upon changing, the subject regains lost hit points as if it had rested for a night (though this healing does not restore temporary ability damage and provide other benefits of resting; and changing back does not heal the subject further). If slain, the subject reverts to its original form, though it remains dead." +
        "The subject **gains the Strength, Dexterity, and Constitution scores** of the new form but **retains its own Intelligence, Wisdom, and Charisma scores**. It also **gains all extraordinary special attacks** possessed by the form (such as constrict, improved grab, and poison) but **does not gain the extraordinary special qualities** possessed by the new form (such as blindsense, fast healing, regeneration, and scent) or any supernatural or spell-like abilities." +
        "Incorporeal or gaseous creatures are immune to being polymorphed, and a creature with the shapechanger subtype (such as a lycanthrope or a doppelganger) can revert to its natural form as a standard action.";


    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

alter_self = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Alter Self";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/alter-self--2774/";
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
    let level       = "Sor/Wiz 2";// "Sor/Wiz 2, Wu Jen 2 (Metal), Sha'ir 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';


    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = (((meta_effect.extend_spell)? 20 : 10) * caster.casterlevel) +" minutes";
    let effect      = 'You assume the form of a creature of the same type as your normal form (such as humanoid or magical beast).';
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;
    let hd= Math.min(5, caster.casterlevel);
    let notes       ="**HD:" + hd + "**<br>" +
        "You assume the form of a creature of the same type as your normal form " +
        "(such as humanoid or magical beast). The new form **must be within one size category of your normal size**. " +
        "You can change into a member of your own kind or even into yourself. **You retain your own ability scores**. " +
        "**Your class and level, hit points, alignment, base attack bonus, and base save bonuses all remain the same**. " +
        "Your creature type and subtype (if any) remain the same regardless of your new form. " +
        "You can freely designate the new form's minor physical qualities (such as hair color, " +
        "hair texture, and skin color) within the normal ranges for a creature of that kind. The new form's significant " +
        "physical qualities (such as height, weight, and gender) are also under your control, but they must fall within " +
        "the norms for the new form's kind. You are effectively disguised as an average member of the new form's race. " +
        "If you use this spell to create a disguise, you get a **+10 bonus on your Disguise check**. When the change " +
        "occurs, **your equipment**, if any, either **remains worn or held by the new form** " +
        "(if it is capable of wearing or holding the item), **or melds into the new form and becomes nonfunctional**. " +
        "When you revert to your true form, any objects previously melded into the new form reappear in the same " +
        "location on your body they previously occupied and are once again functional. Any new items you wore in the " +
        "assumed form and can't wear in your normal form fall off and land at your feet; any that you could wear in " +
        "either form or carry in a body part common to both forms (mouth, hands, or the like) at the time of reversion " +
        "are still held in the same way. Any part of the body or piece of equipment that is separated from the whole " +
        "reverts to its true form.";


    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

hallucinatory_terrain = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Hallucinatory Terrain";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/hallucinatory-terrain--2671/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A stone, a twig, and a bit of green plant',
            f: undefined
        };
    }

    let compatible_feats = [
        'extend_spell', 'sudden_extend',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'enlarge_spell', 'sudden_enlarge'
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+") on "+target.name;
    let school      = "Illusion";
    let level       = "Sor/Wiz 4";// "Sor/Wiz 2, Wu Jen 2 (Metal), Sha'ir 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = "10 minutes";
    let range       = (((meta_effect.enlarge_spell)? 800 : 400) + 40 * caster.casterlevel) +" ft";
    let duration    = (((meta_effect.extend_spell)? 4 : 2) * caster.casterlevel) +" hours";
    let effect      = undefined;
    let saving_throw= "Will disbelief (if interacted with) <br> (DC: [[@{spelldc4}+@{sf-illusion}]])";
    let spell_resist= "No";
    let ranged_touch= undefined;

    let notes       ="You make natural terrain look, sound, and smell like some other sort of natural terrain. " +
        "Thus, open fields or a road can be made to resemble a swamp, hill, crevasse, or some other difficult " +
        "or impassable terrain. A pond can be made to seem like a grassy meadow, a precipice like a gentle slope, " +
        "or a rock-strewn gully like a wide and smooth road. Structures, equipment, and creatures within the " +
        "area are not hidden or changed in appearance. Material Component: A stone, a twig, and a bit of green plant.";


    let fx          = undefined;
    let gm_command  =  undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

whispering_wind = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Whispering Wind";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/whispering-wind--2895/";
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
        'quicken_spell', 'sudden_quicken',
        'silent_spell', 'sudden_silent',
        'still_spell', 'sudden_still',
        'enlarge_spell', 'sudden_enlarge',
        'widen_spell', 'sudden_widen',
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
    let school      = "Transmutation (Air)";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = ((meta_effect.widen_spell)? 2 : 1) * caster.casterlevel + " miles";
    let duration    = ((meta_effect.extend_spell)? 2: 1) * caster.casterlevel + 'hours or until discharged ' +
        '(destination is reached)';
    let effect      = 'You send a message or sound on the wind to a designated area of ' + ((meta_effect.widen_spell)? 20 : 10) + 'ft';
    let saving_throw= "None";
    let spell_resist= "No";
    let ranged_touch= undefined;

    let notes  = "The whispering wind travels to a specific location within range that is familiar to you, provided that it can find a way to the location. (It can't pass through walls, for instance). A whispering wind is as gentle and unnoticed as a zephyr until it reaches the location. It then delivers its whisper-quiet message or other sound. Note that the message is delivered regardless of whether anyone is present to hear it. The wind then dissipates. You can prepare the spell to bear a message of **no more than 25 words**, cause the spell to deliver **other sounds for 1 round**, or merely have the whispering wind seem to be a faint stirring of the air. You can likewise cause the whispering wind to **move as slowly as 1 mile per hour or as quickly as 1 mile per 10 minutes**. When the spell reaches its objective, it swirls and remains in place until the message is delivered. As with magic mouth, whispering wind **cannot speak verbal components, use command words, or activate magical effects**.";

    let fx          =  undefined;
    let gm_command  = 'Whispering Wind message: **?{Message}**';

    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

wall_of_ice = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Wall of Ice";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/wall-of-ice--2660/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: 'A small piece of quartz or similar rock crystal.',
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
    let school      = "Evocation [Cold]";
    let level       = "Sor/Wiz 4";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "M";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = 'Anchored plane of ice, up to one ' + ((meta_effect.widen_spell)? 20 : 10) * caster.casterlevel +
        ' ft. square, or hemisphere of ice with a radius of up to ' + (3 +  caster.casterlevel) + ' ft.';
    let saving_throw= "Reflex negates; see text<br>(DC: [[@{spelldc4}+@{sf-evocation}]])";
    let spell_resist= "Yes<br>(DC: [[ 1d20+@{casterlevel}+@{spellpen} ]])";
    let ranged_touch= undefined;
    let dc = (15 + caster.casterlevel);
    let notes       = "This spell creates an anchored plane of ice or a hemisphere of ice, depending on the version " +
        "selected. A wall of ice cannot form in an area occupied by physical objects or creatures. Its surface must " +
        "be smooth and unbroken when created. Any creature adjacent to the wall when it is created may attempt " +
        "a Reflex save to disrupt the wall as it is being formed. A successful save indicates that the spell " +
        "automatically fails. " +
        "**Fire, including a fireball spell and red dragon breath, can melt a wall of ice, and it deals full " +
        "damage to the wall (instead of the normal half damage taken by objects)**. Suddenly melting a wall of ice " +
        "creates a great cloud of steamy fog that lasts for 10 minutes. " +
        "<br>**-> Ice Plane:**<br>" +
        "A sheet of strong, hard ice appears. The wall is **" + caster.casterlevel + " inch thick**. " +
        "It covers up to a **" + ((meta_effect.widen_spell)? 20 : 10) * caster.casterlevel + " ft.-square area.** " +
        "The plane can be oriented in any fashion as long as it is anchored. A vertical wall need only be anchored on " +
        "the floor, while a horizontal or slanting wall must be anchored on two opposite sides. " +
        "The wall is primarily defensive in nature and is used to stop pursuers from following you and the like. " +
        "Each **10-foot square of wall has " + (3 * caster.casterlevel) + " hit points**. " +
        "Creatures can hit the wall automatically. A section of wall whose hit points drop to 0 is breached. " +
        "If a creature tries to **break through the wall with a single attack**, the **DC for the Strength " +
        "check is " + dc + "**. Even when the ice has been broken through, a sheet of frigid air remains. " +
        "**Any creature stepping through it takes 1d6 + " + caster.casterlevel + " points of cold damage (no save)**. " +
        "<br>**-> Hemisphere:**<br>" +
        "The wall takes the form of a hemisphere whose **maximum radius is " + (3 +  caster.casterlevel) + " ft.** "
        "The hemisphere is as hard to break through as the ice plane form, but it **does not deal damage** " +
        "to those who go through a breach. ";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        let spell = create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
        return spell;
    }
};

major_image = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Major Image";
    let url         = "https://dndtools.net/spells/players-handbook-v35--6/major-image--2681/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A bit of Fleece'
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
    let school      = "Illusion [Figment]";
    let level       = "Sor/Wiz 3";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Long: "+((400*((meta_effect.enlarge_spell)? 2 : 1))+40*caster.casterlevel) +" ft";
    let duration    = 'Concentration +'+((meta_effect.extend_spell)? 6 : 3)+' rounds';
    let effect      = 'Visual figment that cannot extend beyond four ' +
        ((meta_effect.widen_spell)? 80 : 40)+(10*caster.casterlevel)+'ft. cubes.';
    let saving_throw= "Will disbelief (if interacted with)<br>(DC: [[@{spelldc3}+@{sf-illusion}]])";
    let spell_resist= spell_resist.no;
    let ranged_touch= undefined;
    let dc = (15 + caster.casterlevel);
    let notes       = "This spell creates the visual illusion of an" +
        "object, creature, or force, as visualized by" +
        "you. The illusion does create sound," +
        "smell, texture and temperature. You can" +
        "move the image within the limits of the" +
        "size of the effect.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        return create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
    }
};

dark_way = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Dark Way";
    let url         = "https://dndtools.net/spells/spell-compendium--86/dark-way--4326/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'Small black ribbon'
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
    let school      = "Illusion [Shadow]";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S,';
    comp   += "F";

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+20*caster.casterlevel) +" ft";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds';
    let effect      = 'One bridge of force 5 ft. wide, 1 in. thick, and up to '+(caster.casterlevel*20)+' ft./level long';
    let saving_throw= "None";
    let spell_resist= spell_resist.yes;
    let ranged_touch= undefined;
    let dc = (15 + caster.casterlevel);
    let notes       = "You create a ribbonlike, weightless unbreakable bridge. A dark way must be anchored at both ends" +
        " to solid objects, but otherwise can be at any angle. Like a wall of force (PH 298), it must be continuous " +
        "and unbroken when formed. Creatures can move on a dark way without penalty, since it is no more slippery than a typical dungeon floor. A dark way can support a maximum of "+(200*caster.casterlevel)+" pounds. Creatures that cause the total weight on a dark way to exceed this limit fall through it as if it weren't there, but **only** those who exceed it.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        return create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
    }
};

devils_eye = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Devil's Eye";
    let url         = "https://dndtools.net/spells/fiendish-codex-ii-tyrants-of-the-nine-hells--67/devils-eye--1173/";
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
    let level       = "Sor/Wiz 3";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = undefined;
    let saving_throw= "None";
    let spell_resist= spell_resist.no;
    let ranged_touch= undefined;
    let dc = (15 + caster.casterlevel);
    let notes       = "With a few words and a gesture, the darkness melts away, and you can see with perfect clarity." +
        "You gain the visual acuity of a devil." +
        "You can see in darkness and magical darkness out to 30 feet.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        return create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
    }
};

nightshield = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Nightshield";
    let url         = "http://dndtools.org/spells/spell-compendium--86/nightshield--4595/";
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
    let school      = "Abjuration";
    let level       = "Sor/Wiz 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp   += (meta_effect.still_spell)? '' : 'S';

    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = "Personal";
    let duration    = caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes';
    let effect      = 'With a whisper-quiet whoosh, a field of shadowy energy cloaks your body.';
    let saving_throw= "None";
    let spell_resist= spell_resist.no;
    let ranged_touch= undefined;
    let dc = (15 + caster.casterlevel);
    let bonus = 1;
    if (caster.casterlevel>= 6) {
        bonus = 2;
    }
    if (caster.casterlevel>= 9) {
        bonus = 3;
    }

    let notes       = "This spell provides a +1 resistance bonus on saving throws. " +
        "This resistance bonus increases to +"+bonus+
        ". In addition, the spell negates magic missile attacks directed at you.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        return create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
    }
};

ray_of_flame = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Ray of Flame";
    let url         = "https://dndtools.net/spells/spell-compendium--86/ray-flame--4066/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A small, polished glass lens'
        };
    }

    let compatible_feats = [
        ...meta_feat_selector.empower, /* dmg x 1,5 */
        ...meta_feat_selector.enlarge, /* range x 2 */
//        ...meta_feat_selector.extend, /* duration x 2 */
        ...meta_feat_selector.maximize, /* max rolls */
        ...meta_feat_selector.quicken, /* free action cast time */
        ...meta_feat_selector.silent, /* no verbal componen */
        ...meta_feat_selector.still, /* no somatic component */
//        ...meta_feat_selector.widen /* AoE x 2 */
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    const range_preset = {
        close: "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*Math.floor(caster.casterlevel/2)) +" ft",
        medium: "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft",
        long: "Long: "+((400*((meta_effect.enlarge_spell)? 2 : 1))+40*caster.casterlevel) +" ft"
    };

    const duration_preset = {
        days: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' days',
        hours: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours',
        minutes: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes',
        seconds: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' seconds',
        rounds: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds',
        instantaneous: 'instantaneous'
    };

    const ranged_touch_preset = {
        yes: "[[1d20 + "+caster.get_attr('bab')+'+'+caster.get_attr('dex-mod')+"]]",
        no: undefined
    };

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Evocation [Fire]";
    let level       = "Sor/Wiz 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp    += (meta_effect.still_spell)? '' : 'S';
    comp    += 'F';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = range_preset.close;
    let duration    = duration_preset.instantaneous;
    let effect      = 'Ray';
    let saving_throw= "Reflex DC 15; see text";
    let spell_resist= spell_resist.yes;
    let ranged_touch= ranged_touch_preset.yes;
    let dc = (15 + caster.casterlevel);
    const dice = Math.min(Math.floor(caster.casterlevel/2), 5);
    let checkroll = '[['+dice+'d6]] ';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll = '[['+(dice*6)+'+floor(('+dice+'d6)*0.5)]]';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll = '[['+(dice*6)+']] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll = '[[floor(('+dice+'d6)*1.5)]] ';
    }
    let notes       = "You must succeed on a ranged touch attack. If your attack is successful, the ray " +
        "deals "+checkroll+" points of fire damage. The target must also make a Reflex save or catch fire, taking **1d6 points of fire damage each round** until the flames are put out (requiring a DC 15 Reflex save; see Catching on Fire, DMG 303)";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        return create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
    }
};

deep_breath = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Deep Breath";
    let url         = "https://dndtools.net/spells/spell-compendium--86/deep-breath--4352/";
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
//        ...meta_feat_selector.empower, /* dmg x 1,5 */
//        ...meta_feat_selector.enlarge, /* range x 2 */
        ...meta_feat_selector.extend, /* duration x 2 */
//        ...meta_feat_selector.maximize, /* max rolls */
//        ...meta_feat_selector.quicken, /* free action cast time */
        ...meta_feat_selector.silent, /* no verbal componen */
//        ...meta_feat_selector.still, /* no somatic component */
//        ...meta_feat_selector.widen /* AoE x 2 */
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    const range_preset = {
        close: "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*Math.floor(caster.casterlevel/2)) +" ft",
        medium: "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft",
        long: "Long: "+((400*((meta_effect.enlarge_spell)? 2 : 1))+40*caster.casterlevel) +" ft",
        personal: "Personal"
    };

    const duration_preset = {
        days: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' days',
        hours: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours',
        minutes: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes',
        seconds: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' seconds',
        rounds: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds',
        instantaneous: 'instantaneous'
    };

    const ranged_touch_preset = {
        yes: "[[1d20 + "+caster.get_attr('bab')+'+'+caster.get_attr('dex-mod')+"]]",
        no: undefined
    };

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Conjuration [Air]";
    let level       = "Sor/Wiz 1";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V';

    let cast_time   = "1 immediate action";
    let range       = range_preset.personal;
    let duration    = duration_preset.rounds;
    let effect      = undefined;
    let saving_throw= undefined;
    let spell_resist= spell_resist.no;
    let ranged_touch= ranged_touch_preset.no;
    let dc = (15 + caster.casterlevel);

    let notes       = "Your lungs instantly fill with air, and continue to refill with air for the duration " +
        "of the spell. When the spell's duration expires, you can continue to hold your breath as if you had just " +
        "gulped down a lungful of air. You can cast this spell with an instant utterance, quickly enough to save " +
        "yourself from drowning after being suddenly plunged into water.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        return create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
    }
};

scorch = function(caster_id, target_id, meta_effect, metas, info=null) {
    let spellname   = "Scorch";
    let url         = "https://dndtools.org/spells/spell-compendium--86/scorch--4131/";
    if(info === 'list'){
        return '['+spellname+']('+url+')';
    }
    if(info === 'mat_comp'){
        return {
            m: undefined,
            f: 'A red dragon\'s scale'
        };
    }

    let compatible_feats = [
        ...meta_feat_selector.empower, /* dmg x 1,5 */
        ...meta_feat_selector.enlarge, /* range x 2 */
//        ...meta_feat_selector.extend, /* duration x 2 */
        ...meta_feat_selector.maximize, /* max rolls */
        ...meta_feat_selector.quicken, /* free action cast time */
        ...meta_feat_selector.silent, /* no verbal componen */
        ...meta_feat_selector.still, /* no somatic component */
        ...meta_feat_selector.widen /* AoE x 2 */
    ];

    meta_effect = sudden_helper(meta_effect);

    if(info === 'feats'){
        return compatible_feats;
    }

    const range_preset = {
        close: "Close: "+((25*((meta_effect.enlarge_spell)? 2 : 1))+5*Math.floor(caster.casterlevel/2)) +" ft",
        medium: "Medium: "+((100*((meta_effect.enlarge_spell)? 2 : 1))+10*caster.casterlevel) +" ft",
        long: "Long: "+((400*((meta_effect.enlarge_spell)? 2 : 1))+40*caster.casterlevel) +" ft",
        personal: "Personal",
        none: undefined
    };

    const duration_preset = {
        days: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' days',
        hours: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' hours',
        minutes: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' minutes',
        seconds: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' seconds',
        rounds: caster.casterlevel*((meta_effect.extend_spell)? 2 : 1)+' rounds',
        instantaneous: 'instantaneous'
    };

    const ranged_touch_preset = {
        yes: "[[1d20 + "+caster.get_attr('bab')+'+'+caster.get_attr('dex-mod')+"]]",
        no: undefined
    };

    let caster      = create_creature(caster_id);
    let target      = create_creature(target_id);
    let spell_tag   = "casts ["+spellname+"]("+url+")";
    let school      = "Evocation [Fire]";
    let level       = "Sor/Wiz 2";
    let meta        = (metas.length > 0)? metas : "No";

    let comp        = (meta_effect.silent_spell)? '' : 'V,';
    comp    += (meta_effect.still_spell)? '' : 'S';
    comp    += 'F';
    let cast_time   = (meta_effect.quicken_spell)? "free action" : "1 std action";
    let range       = range_preset.none;
    let duration    = duration_preset.instantaneous;
    let effect      = 'Line';
    let saving_throw= "Reflex (half)<br>(DC: [[@{spelldc2}+@{sf-evocation}]])";
    let spell_resist= spell_resist.yes;
    let ranged_touch= ranged_touch_preset.no;
    let dc = (15 + caster.casterlevel);
    const dice = Math.min(Math.floor(caster.casterlevel/2), 5);
    let checkroll = '[['+dice+'d8]] ';
    if(meta_effect.maximize_spell && meta_effect.empower_spell){ //maximize and empower
        checkroll = '[['+(dice*8)+'+floor(('+dice+'d8)*0.5)]]';
    }else if(meta_effect.maximize_spell){ //maximize but no empower
        checkroll = '[['+(dice*8)+']] ';
    }else if(meta_effect.empower_spell){ //empower but no maximize
        checkroll = '[[floor(('+dice+'d8)*1.5)]] ';
    }
    let notes       = "Scorch deals "+checkroll+" points of damage to each target it hits.";

    let fx          = undefined;
    let gm_command  =   undefined;


    if(info === null){
        return create_spell(spellname, caster, target, spell_tag, school, level, meta, comp, cast_time, range, duration, effect, saving_throw, spell_resist, ranged_touch, notes, fx, gm_command);
    }
};

const spells = {
    "read_magic" : read_magic,
    "unseen_servant" : unseen_servant,
    "shield" : shield,
    "mount" : mount,
    "identify"  : identify,
    "mage_hand_greater" : mage_hand_greater,
    "power_word_pain" : power_word_pain,
    "nystuls_magic_aura" : nystuls_magic_aura,
    "sleep" : sleep,
    "disguise_self" : disguise_self,
    "detect_secret_doors" : detect_secret_doors,
    "vigilant_slumber" : vigilant_slumber,
    "endure_elements" : endure_elements,
    "persistent_blade" : persistent_blade,
    "comprehend_languages" : comprehend_languages,
    "protection_from_evil" : protection_from_evil,
    "feather_fall" : feather_fall,
    "lesser_orb_fire" : lesser_orb_fire,
    "dimension_door"  : dimension_door,
    "burning_blood" : burning_blood,
    "defenestrating_sphere" : defenestrating_sphere,
    'arcane_sight'  : arcane_sight,
    'dispel_magic' : dispel_magic,
    'fireball' : fireball,
    'fireburst' : fireburst,
    'haste' : haste,
    // 'haste_3_0' : haste_3_0,
    'low_light_vision' : low_light_vision,
    'mage_armor'  : mage_armor,
    'magic_missile' : magic_missile,
    'mass_darkvision' : mass_darkvision,
    'protection_from_arrows' : protection_from_arrows,
    'swim'  : swim,
    'wall_of_gloom' : wall_of_gloom,
    'detect_thoughts' : detect_thoughts,
    'locate_object' : locate_object,
    'see_invisibility' : see_invisibility,
    'darkvision' : darkvision,
    'bears_endurance' : bears_endurance,
    'darkness' : darkness,
    'resist_energy' : resist_energy,
    'spectral_hand' : spectral_hand,
    'cats_grace' : cats_grace,
    'rope_trick' : rope_trick,
    'knock' : knock,
    'web' : web,
    'invisibility' : invisibility,
    'lightning_bolt' : lightning_bolt,
    'fly' : fly,
    'shrink_item' : shrink_item,
    'protection_from_energy' : protection_from_energy,
    'shatterfloor' : shatterfloor,
    'vampiric_touch' : vampiric_touch,
    'hallucinatory_terrain' : hallucinatory_terrain,
    'polymorph': polymorph,
    'whispering_wind': whispering_wind,
    'wall_of_ice': wall_of_ice,
    'alter_self': alter_self,
    'major_image': major_image,
    'dark_way': dark_way,
    'devils_eye': devils_eye,
    'nightshield': nightshield,
    'ray_of_flame': ray_of_flame,
    'deep_breath': deep_breath,
    'scorch': scorch
};

const no_target = ['arcane_sight', 'read_magic', 'unseen_servant', 'identify', 'shield', 'mount',
    'mage_hand_greater', 'nystuls_magic_aura', 'sleep', 'disguise_self', 'comprehend_languages',
    'persistent_blade', 'vigilant_slumber','feather_fall', 'dimension_door', 'defenestrating_sphere',
    'dispel_magic', 'fireball', 'fireburst', 'haste', 'magic_missile', 'mass_darkvision',
    'wall_of_gloom', 'detect_thoughts', 'locate_object', 'see_invisibility', 'darkness',
    'spectral_hand', 'knock', 'web', 'lightning_bolt', 'shrink_item', 'shatterfloor', 'rope_trick',
    'hallucinatory_terrain', 'whispering_wind', 'wall_of_ice', 'alter_self', 'major_image', 'dark_way',
    'devils_eye', 'nightshield', 'deep_breath', 'scorch'];
