<template>
  <div id="app">
    <h2>
      Vue Searchbox Demo
      <span style="font-size:1rem;">
        <a
          href="https://docs.appbase.io/docs/reactivesearch/vue-searchbox/apireference/"
          target="_blank"
          >API reference</a
        >
      </span>
    </h2>
    <search-base
      index="good-books-ds"
      credentials="a03a1cb71321:75b6603d-9456-4a5a-af6b-a487b309eb61"
      url="https://appbase-demo-ansible-abxiydt-arc.searchbase.io"
      :appbaseConfig="{
        recordAnalytics: true,
        enableQueryRules: true,
        userId: 'jon@appbase.io',
        customEvents: {
          platform: 'ios',
          device: 'iphoneX'
        }
      }"
    >
      <div>
        <search-box
          id="search-component"
          :dataField="[
            {
              field: 'original_title',
              weight: 1
            },
            {
              field: 'original_title.search',
              weight: 3
            }
          ]"
          title="Search"
          placeholder="Search for Books"
          :size="5"
          :value="this.$data.text"
          @change="handleChange"
          @blur="handleBlur"
          @keyPress="handleKeyPress"
          @focus="handleFocus"
          @key-down="handleKeyDown"
          @key-up="handleKeyUp"
        />
        <div>
          <search-component
            id="result-component"
            :dataField="['original_title']"
            :size="5"
            :react="{ and: ['search-component'] }"
          >
            <div
              class="result-list-container"
              slot-scope="{ loading, error, results, size, from, setFrom }"
            >
              <div v-if="loading">Fetching Results ....</div>
              <div v-if="Boolean(error)">
                Something went wrong! Error details
                {{ JSON.stringify(error) }}
              </div>
              <p v-if="!loading && !error">
                {{ results.numberOfResults }} results found in
                {{ results.time }}ms
              </p>
              <div v-if="!loading && !error">
                <div v-bind:key="item._id" v-for="item in results.data">
                  <div class="flex book-content" key="item._id">
                    <img
                      :src="item.image"
                      alt="Book Cover"
                      class="book-image"
                    />
                    <div class="flex column justify-center ml20">
                      <div class="book-header">{{ item.original_title }}</div>
                      <div class="flex column justify-space-between">
                        <div>
                          <div>
                            by
                            <span class="authors-list">{{
                              item.authors
                            }}</span>
                          </div>
                          <div class="ratings-list flex align-center">
                            <span class="stars">
                              <i
                                v-for="(item, index) in Array(
                                  item.average_rating_rounded
                                ).fill('x')"
                                class="fas fa-star"
                                :key="index"
                              />
                            </span>
                            <span class="avg-rating"
                              >({{ item.average_rating }} avg)</span
                            >
                          </div>
                        </div>
                        <span class="pub-year"
                          >Pub {{ item.original_publication_year }}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
                <div class="pagination-wrapper">
                  <paginate
                    v-if="results.numberOfResults"
                    :value="Math.ceil(from / size) + 1"
                    :page-count="Math.ceil(results.numberOfResults / size)"
                    :click-handler="page => setFrom((page - 1) * size)"
                    :prev-text="'Prev'"
                    :next-text="'Next'"
                    :container-class="'pagination'"
                  ></paginate>
                </div>
              </div>
            </div>
          </search-component>
        </div>
      </div>
    </search-base>
  </div>
</template>

<script>
import Paginate from 'vuejs-paginate';
import {
  SearchBase,
  SearchComponent,
  SearchBox
} from '@appbaseio/vue-searchbox';
import './styles.css';

export default {
  name: 'app',
  components: {
    SearchBase,
    SearchBox,
    SearchComponent,
    Paginate
  },
  data() {
		const state = {
			text: ''
		};
		return state;
	},
  methods: {
    isChecked(value, key) {
      return value ? value.includes(key) : false;
    },
    handleChange(value, searchComponent, e) {
      this.$data.text = value;
      // To fetch suggestions
      // searchComponent.triggerDefaultQuery();
      // To update results
      searchComponent.triggerCustomQuery();
    },
    handleBlur(searchComponent, e) {
      // searchComponent.triggerCustomQuery();
      // console.log('handleBlur called ==>> ', searchComponent, e);
    },
    handleKeyPress(searchComponent, e) {
      // console.log('handleKeyPress called ==>> ', searchComponent, e);
    },
    handleFocus(searchComponent, e) {
      // console.log('handleFocus called ==>> ', searchComponent, e);
    },
    handleKeyDown(searchComponent, e) {
      // console.log('handleKeyDown called ==>> ', searchComponent, e);
    },
    handleKeyUp(searchComponent, e) {
      // console.log('handleKeyUp called ==>> ', searchComponent, e);
    },
  }
};
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
