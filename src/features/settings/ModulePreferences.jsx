import React from 'react';
import { RotateCcw, Save, Loader2, Check, Package } from 'lucide-react';
import { useModulePreferences } from '../../hooks/useModulePreferences';
import { MODULE_DEFINITIONS, getModulesByCategory } from '../../config/moduleDefinitions';
import { useToast } from '../../context/ToastContext';

export function ModulePreferences({ user }) {
  const { preferences, loading, toggleModule, toggleSubModule } = useModulePreferences(user);
  const { addToast } = useToast();

  const modulesByCategory = getModulesByCategory();
  const categories = ['EXECUTION', 'LEADERSHIP', 'OUTPUTS', 'SYSTEM'];

  const handleToggle = async (moduleId) => {
    try {
      await toggleModule(moduleId);
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to update module preference');
    }
  };

  const handleSubModuleToggle = async (moduleId, subModuleId) => {
    try {
      await toggleSubModule(moduleId, subModuleId);
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to update sub-module preference');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Customization
          </p>
          <h2 className="text-2xl font-bold text-slate-900">Module Preferences</h2>
          <p className="text-sm text-slate-500 mt-1">
            Choose which modules appear in your navigation. Changes take effect immediately.
          </p>
        </div>
      </div>

      {/* Module Categories */}
      <div className="space-y-6">
        {categories.map((category) => {
          const modules = modulesByCategory[category] || [];
          if (modules.length === 0) return null;

          return (
            <div key={category} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-slate-900 rounded-full" />
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
                  {category}
                </h3>
              </div>

              <div className="space-y-3">
                {modules.map((module) => {
                  const isEnabled = preferences?.modules?.[module.id]?.enabled ?? false;
                  const ModuleIcon = module.icon;
                  const hasSubModules = module.subModules && Object.keys(module.subModules).length > 0;

                  return (
                    <div key={module.id} className="space-y-2">
                      {/* Main Module Toggle */}
                      <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        module.required
                          ? 'border-slate-200 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                        <div className="flex items-center h-6">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggle(module.id)}
                            disabled={module.required}
                            className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-900 focus:ring-offset-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <ModuleIcon size={16} className="text-slate-600 flex-shrink-0" />
                            <h4 className="text-sm font-semibold text-slate-900">
                              {module.label}
                            </h4>
                            {module.required && (
                              <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
                                Required
                              </span>
                            )}
                            {module.note && !module.required && (
                              <span className="text-xs text-slate-500 italic">
                                ({module.note})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {module.description}
                          </p>
                        </div>
                        {isEnabled && !module.required && (
                          <div className="flex items-center h-6">
                            <Check size={16} className="text-emerald-600" />
                          </div>
                        )}
                        {module.required && (
                          <div className="flex items-center h-6">
                            <Check size={16} className="text-slate-500" />
                          </div>
                        )}
                      </div>

                      {/* Sub-modules (if parent is enabled) */}
                      {hasSubModules && isEnabled && (
                        <div className="ml-11 space-y-2 border-l-2 border-slate-200 pl-4">
                          {Object.entries(module.subModules).map(([subModuleId, subModule]) => {
                            const isSubEnabled = preferences?.modules?.[module.id]?.subModules?.[subModuleId] ?? false;
                            const SubModuleIcon = subModule.icon;

                            return (
                              <div
                                key={subModuleId}
                                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-all"
                              >
                                <div className="flex items-center h-5">
                                  <input
                                    type="checkbox"
                                    checked={isSubEnabled}
                                    onChange={() => handleSubModuleToggle(module.id, subModuleId)}
                                    className="w-4 h-4 rounded border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-700 focus:ring-offset-0 cursor-pointer"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {SubModuleIcon && (
                                      <SubModuleIcon size={14} className="text-slate-500 flex-shrink-0" />
                                    )}
                                    <h5 className="text-xs font-medium text-slate-800">
                                      {subModule.label}
                                    </h5>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {subModule.description}
                                  </p>
                                </div>
                                {isSubEnabled && (
                                  <div className="flex items-center h-5">
                                    <Check size={14} className="text-emerald-600" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Package size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-blue-900">Real-time module visibility</p>
          <p className="text-blue-700 mt-1">
            Changes apply instantly to your navigation sidebar. Disabled modules won't appear, but you can re-enable them at any time. 
            Settings module is always available and cannot be disabled.
          </p>
        </div>
      </div>
    </div>
  );
}
