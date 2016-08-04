using MediaBrowser.Common.Configuration;
using MediaBrowser.Model.LiveTv;
using System.Collections.Generic;

namespace MediaBrowser.Server.Implementations.LiveTv
{
    public class LiveTvConfigurationFactory : IConfigurationFactory
    {
        public IEnumerable<ConfigurationStore> GetConfigurations()
        {
            return new List<ConfigurationStore>
            {
                new ConfigurationStore
                {
                     ConfigurationType = typeof(LiveTvOptions),
                     Key = "livetv"
                }
            };
        }
    }

    public static class LiveTvConfigExtension
    {
        public static LiveTvOptions GetLiveTvOptions(this IConfigurationManager config)
        {
            return config.GetConfiguration<LiveTvOptions>("livetv");
        }
    }

}
